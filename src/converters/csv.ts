import type { DocumentConverter, DocumentConverterResult, StreamInfo } from "./types";

const ACCEPTED_EXTENSIONS = [".csv", ".tsv"];
const ACCEPTED_MIMETYPES = ["text/csv", "application/csv", "text/tab-separated-values"];

function parseCSV(content: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let inQuote = false;
  let cur = "";
  let row: string[] = [];

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (inQuote) {
      if (ch === '"' && next === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuote = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === delimiter) {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
      if (ch === "\r") i++;
      row.push(cur);
      cur = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else {
      cur += ch;
    }
  }
  if (cur || row.length) {
    row.push(cur);
    if (row.some((c) => c !== "")) rows.push(row);
  }
  return rows;
}

function rowsToMarkdown(rows: string[][]): string {
  if (!rows.length) return "";
  const header = rows[0];
  const lines = [
    "| " + header.join(" | ") + " |",
    "| " + header.map(() => "---").join(" | ") + " |",
    ...rows.slice(1).map((row) => {
      while (row.length < header.length) row.push("");
      return "| " + row.slice(0, header.length).join(" | ") + " |";
    }),
  ];
  return lines.join("\n");
}

export class CsvConverter implements DocumentConverter {
  accepts(file: File, streamInfo: StreamInfo): boolean {
    const ext = (streamInfo.extension || "").toLowerCase();
    const mime = (streamInfo.mimetype || "").toLowerCase();
    if (ACCEPTED_EXTENSIONS.includes(ext)) return true;
    return ACCEPTED_MIMETYPES.some((m) => mime.startsWith(m));
  }

  async convert(file: File, streamInfo: StreamInfo): Promise<DocumentConverterResult> {
    const text = await file.text();
    const ext = (streamInfo.extension || "").toLowerCase();
    const delimiter = ext === ".tsv" ? "\t" : ",";
    const rows = parseCSV(text, delimiter);
    return { markdown: rowsToMarkdown(rows) };
  }
}
