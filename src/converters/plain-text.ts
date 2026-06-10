import type { DocumentConverter, DocumentConverterResult, StreamInfo } from "./types";

const ACCEPTED_EXTENSIONS = [".txt", ".md", ".rst", ".log", ".text"];
const ACCEPTED_MIMETYPES = ["text/plain", "text/markdown", "text/x-rst"];

export class PlainTextConverter implements DocumentConverter {
  accepts(file: File, streamInfo: StreamInfo): boolean {
    const ext = (streamInfo.extension || "").toLowerCase();
    const mime = (streamInfo.mimetype || "").toLowerCase();
    if (ACCEPTED_EXTENSIONS.includes(ext)) return true;
    return ACCEPTED_MIMETYPES.some((m) => mime.startsWith(m));
  }

  async convert(file: File, streamInfo: StreamInfo): Promise<DocumentConverterResult> {
    const charset = streamInfo.charset || "utf-8";
    const text = await file.text();
    return { markdown: text };
  }
}
