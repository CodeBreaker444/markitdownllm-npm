import type { DocumentConverter, DocumentConverterResult, StreamInfo } from "./types";

const ACCEPTED_EXTENSIONS = [".pdf"];
const ACCEPTED_MIMETYPES = ["application/pdf", "application/x-pdf"];

interface TextItem {
  x: number;
  y: number;
  text: string;
}

interface Row {
  y: number;
  items: TextItem[];
  text: string; // full joined text of the row
}

// Cluster sorted values into groups separated by at least `gap`
function cluster(values: number[], gap: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const centers: number[] = [];
  for (const v of sorted) {
    if (!centers.length || v - centers[centers.length - 1] > gap) centers.push(v);
  }
  return centers;
}

// Does `x` land within `tolerance` of any center?
function nearAny(x: number, centers: number[], tolerance: number): boolean {
  return centers.some((c) => Math.abs(x - c) <= tolerance);
}

function buildRows(items: { str: string; transform: number[] }[]): Row[] {
  const Y_TOLERANCE = 4;
  const map = new Map<number, TextItem[]>();

  for (const item of items) {
    if (!item.str.trim()) continue;
    const y = Math.round(item.transform[5] / Y_TOLERANCE) * Y_TOLERANCE;
    const x = item.transform[4];
    if (!map.has(y)) map.set(y, []);
    map.get(y)!.push({ x, y, text: item.str });
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => b - a) // descending Y = top-to-bottom
    .map(([y, rowItems]) => {
      const sorted = rowItems.sort((a, b) => a.x - b.x);
      return { y, items: sorted, text: sorted.map((i) => i.text).join(" ") };
    });
}

// Assign items in a row to column buckets
function assignCells(row: Row, columns: number[], tolerance = 35): string[] {
  const cells: string[] = new Array(columns.length).fill("");
  for (const item of row.items) {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < columns.length; i++) {
      const d = Math.abs(item.x - columns[i]);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    cells[best] = cells[best] ? cells[best] + " " + item.text : item.text;
  }
  return cells;
}

// Render a set of rows as a GFM markdown table.
// Returns null if the rows don't form a clean table.
function renderTable(tableRows: Row[], columns: number[]): string | null {
  if (tableRows.length < 2 || columns.length < 2) return null;

  const grid = tableRows.map((row) => assignCells(row, columns));

  // Reject if any cell has long prose (layout column, not data table)
  const maxCellLen = Math.max(...grid.flatMap((r) => r.map((c) => c.length)));
  if (maxCellLen > 180) return null;

  // Remove blank spacer columns
  const blankCol = columns.map((_, i) => grid.every((r) => !r[i].trim()));
  const filtered = grid.map((row) => row.filter((_, i) => !blankCol[i]));
  if (!filtered[0].length || filtered[0].length < 2) return null;

  // Escape pipes, sanitize newlines
  const safe = filtered.map((row) =>
    row.map((c) => c.replace(/\|/g, "\\|").replace(/\n/g, " ").trim())
  );

  const colWidths = safe[0].map((_, i) =>
    Math.max(3, ...safe.map((r) => (r[i] || "").length))
  );

  const fmt = (row: string[]) =>
    "| " + row.map((c, i) => c.padEnd(colWidths[i])).join(" | ") + " |";
  const sep = "| " + colWidths.map((w) => "-".repeat(w)).join(" | ") + " |";

  const [header, ...data] = safe;
  return [fmt(header), sep, ...data.map(fmt)].join("\n");
}

// Detect table regions within a page's rows.
// Returns an array of {start, end, columns} where start/end are row indices.
function detectTableRegions(
  rows: Row[]
): Array<{ start: number; end: number; columns: number[] }> {
  const regions: Array<{ start: number; end: number; columns: number[] }> = [];
  const COL_CLUSTER_GAP = 40;
  const COL_MATCH_TOLERANCE = 35;
  const MIN_TABLE_ROWS = 3;

  let i = 0;
  while (i < rows.length) {
    const row = rows[i];

    // Need at least 2 items to start a table
    if (row.items.length < 2) { i++; continue; }

    // Full row text too long → prose, not table header
    if (row.text.length > 250) { i++; continue; }

    // Seed columns from this row
    const seedCols = cluster(row.items.map((it) => it.x), COL_CLUSTER_GAP);
    if (seedCols.length < 2) { i++; continue; }

    let columns = [...seedCols];
    let j = i + 1;

    while (j < rows.length) {
      const next = rows[j];

      // Empty row or single item → end of table
      if (next.items.length < 1) break;

      // Long prose row → end of table
      if (next.text.length > 250) break;

      // Single item that's very wide (full-width text) → end of table
      if (next.items.length === 1 && next.text.length > 80) break;

      // Check if this row's items align with current columns
      const rowXs = next.items.map((it) => it.x);
      const alignedCount = rowXs.filter((x) => nearAny(x, columns, COL_MATCH_TOLERANCE)).length;
      const alignRatio = alignedCount / rowXs.length;

      // Accept row if ≥60% of its items align with existing columns
      if (alignRatio < 0.6) break;

      // Extend column set with any new positions
      for (const x of rowXs) {
        if (!nearAny(x, columns, COL_MATCH_TOLERANCE)) columns.push(x);
      }
      columns = cluster(columns, COL_CLUSTER_GAP);
      j++;
    }

    const len = j - i;
    if (len >= MIN_TABLE_ROWS) {
      regions.push({ start: i, end: j, columns });
      i = j;
    } else {
      i++;
    }
  }

  return regions;
}

async function pdfToMarkdown(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const rows = buildRows(
      content.items as { str: string; transform: number[] }[]
    );
    if (!rows.length) continue;

    const tableRegions = detectTableRegions(rows);

    // Build a set of row indices that are inside a table region
    const inTable = new Map<number, { regionIdx: number }>();
    tableRegions.forEach((region, ri) => {
      for (let k = region.start; k < region.end; k++) inTable.set(k, { regionIdx: ri });
    });

    const pageLines: string[] = [];
    let lastRegion = -1;

    for (let ri = 0; ri < rows.length; ri++) {
      const tableInfo = inTable.get(ri);

      if (tableInfo) {
        const region = tableRegions[tableInfo.regionIdx];
        // Render entire table region once when we hit its first row
        if (tableInfo.regionIdx !== lastRegion) {
          lastRegion = tableInfo.regionIdx;
          const tableRows = rows.slice(region.start, region.end);
          const rendered = renderTable(tableRows, region.columns);
          if (rendered) {
            pageLines.push(rendered);
          } else {
            // Fallback: render as plain text
            for (const r of tableRows) pageLines.push(r.text);
          }
        }
      } else {
        pageLines.push(rows[ri].text);
      }
    }

    const pageText = pageLines.join("\n").trim();
    if (pageText) pages.push(pageText);
  }

  return pages.join("\n\n").trim();
}

export class PdfConverter implements DocumentConverter {
  accepts(file: File, streamInfo: StreamInfo): boolean {
    const ext = (streamInfo.extension || "").toLowerCase();
    const mime = (streamInfo.mimetype || "").toLowerCase();
    if (ACCEPTED_EXTENSIONS.includes(ext)) return true;
    return ACCEPTED_MIMETYPES.some((m) => mime.startsWith(m));
  }

  async convert(file: File, _streamInfo: StreamInfo): Promise<DocumentConverterResult> {
    const arrayBuffer = await file.arrayBuffer();
    const markdown = await pdfToMarkdown(arrayBuffer);
    return { markdown };
  }
}
