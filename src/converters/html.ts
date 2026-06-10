import TurndownService from "turndown";
// @ts-ignore — no official types for this package
import { gfm } from "@joplin/turndown-plugin-gfm";
import type { DocumentConverter, DocumentConverterResult, StreamInfo } from "./types";

const ACCEPTED_EXTENSIONS = [".html", ".htm"];
const ACCEPTED_MIMETYPES = ["text/html", "application/xhtml"];

function buildTurndown(): TurndownService {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });

  // GFM plugin adds: tables, strikethrough, task lists
  td.use(gfm);

  // Strip non-content nodes
  td.remove(["script", "style", "noscript", "head"]);

  return td;
}

function htmlToMarkdown(html: string): string {
  const td = buildTurndown();

  // Prefer main content area (mirrors Python BeautifulSoup main-content extraction)
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const main =
    doc.querySelector("main") ||
    doc.querySelector("article") ||
    doc.querySelector('[role="main"]') ||
    doc.querySelector("#main-content") ||
    doc.body;

  const source = main?.innerHTML ?? html;
  return td.turndown(source).trim();
}

export class HtmlConverter implements DocumentConverter {
  accepts(file: File, streamInfo: StreamInfo): boolean {
    const ext = (streamInfo.extension || "").toLowerCase();
    const mime = (streamInfo.mimetype || "").toLowerCase();
    if (ACCEPTED_EXTENSIONS.includes(ext)) return true;
    return ACCEPTED_MIMETYPES.some((m) => mime.startsWith(m));
  }

  async convert(file: File, _streamInfo: StreamInfo): Promise<DocumentConverterResult> {
    const html = await file.text();
    return { markdown: htmlToMarkdown(html) };
  }

  convertString(html: string): DocumentConverterResult {
    return { markdown: htmlToMarkdown(html) };
  }
}
