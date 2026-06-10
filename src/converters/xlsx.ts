import type { DocumentConverter, DocumentConverterResult, StreamInfo } from "./types";

const ACCEPTED_XLSX_EXTENSIONS = [".xlsx"];
const ACCEPTED_XLS_EXTENSIONS = [".xls"];
const ACCEPTED_XLSX_MIMETYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const ACCEPTED_XLS_MIMETYPES = ["application/vnd.ms-excel", "application/excel"];

type CellValue = string | number | boolean | null | undefined;

function aoa_to_markdown(rows: CellValue[][]): string {
  // Drop trailing fully-empty rows
  while (rows.length && rows[rows.length - 1].every((c) => c === "" || c == null)) {
    rows.pop();
  }
  if (!rows.length) return "";

  // Stringify cells
  const str = rows.map((row) => row.map((c) => String(c ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ")));

  // Find true column count (max across all rows)
  const cols = Math.max(...str.map((r) => r.length));

  // Pad each row to same width
  const padded = str.map((row) => {
    while (row.length < cols) row.push("");
    return row;
  });

  // Column widths for alignment
  const widths = Array.from({ length: cols }, (_, i) =>
    Math.max(3, ...padded.map((r) => r[i].length))
  );

  const fmt = (row: string[]) =>
    "| " + row.map((c, i) => c.padEnd(widths[i])).join(" | ") + " |";

  const sep = "| " + widths.map((w) => "-".repeat(w)).join(" | ") + " |";

  const [header, ...data] = padded;
  const lines = [fmt(header), sep, ...data.map(fmt)];
  return lines.join("\n");
}

async function sheetsToMarkdown(arrayBuffer: ArrayBuffer): Promise<string> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });

  const sections: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    // header:1 = first row as array (not object keys), defval="" fills empty cells
    const rows = XLSX.utils.sheet_to_json<CellValue[]>(ws, {
      header: 1,
      defval: "",
      blankrows: false,
    });

    if (!rows.length) continue;
    const table = aoa_to_markdown(rows as CellValue[][]);
    if (table) sections.push(`## ${sheetName}\n\n${table}`);
  }

  return sections.join("\n\n");
}

export class XlsxConverter implements DocumentConverter {
  accepts(file: File, streamInfo: StreamInfo): boolean {
    const ext = (streamInfo.extension || "").toLowerCase();
    const mime = (streamInfo.mimetype || "").toLowerCase();
    if (ACCEPTED_XLSX_EXTENSIONS.includes(ext)) return true;
    return ACCEPTED_XLSX_MIMETYPES.some((m) => mime.startsWith(m));
  }

  async convert(file: File, _streamInfo: StreamInfo): Promise<DocumentConverterResult> {
    const arrayBuffer = await file.arrayBuffer();
    return { markdown: await sheetsToMarkdown(arrayBuffer) };
  }
}

export class XlsConverter implements DocumentConverter {
  accepts(file: File, streamInfo: StreamInfo): boolean {
    const ext = (streamInfo.extension || "").toLowerCase();
    const mime = (streamInfo.mimetype || "").toLowerCase();
    if (ACCEPTED_XLS_EXTENSIONS.includes(ext)) return true;
    return ACCEPTED_XLS_MIMETYPES.some((m) => mime.startsWith(m));
  }

  async convert(file: File, _streamInfo: StreamInfo): Promise<DocumentConverterResult> {
    const arrayBuffer = await file.arrayBuffer();
    return { markdown: await sheetsToMarkdown(arrayBuffer) };
  }
}
