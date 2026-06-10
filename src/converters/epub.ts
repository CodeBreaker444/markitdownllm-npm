import type { DocumentConverter, DocumentConverterResult, StreamInfo } from "./types";
import { HtmlConverter } from "./html";

const ACCEPTED_EXTENSIONS = [".epub"];
const ACCEPTED_MIMETYPES = ["application/epub+zip"];

async function epubToMarkdown(arrayBuffer: ArrayBuffer, htmlConverter: HtmlConverter): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(arrayBuffer);

  // Find OPF file from META-INF/container.xml
  const containerXml = await zip.file("META-INF/container.xml")?.async("text");
  if (!containerXml) throw new Error("Invalid EPUB: missing container.xml");

  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXml, "application/xml");
  const rootfile = containerDoc.querySelector("rootfile");
  const opfPath = rootfile?.getAttribute("full-path");
  if (!opfPath) throw new Error("Invalid EPUB: missing OPF path");

  const opfXml = await zip.file(opfPath)?.async("text");
  if (!opfXml) throw new Error("Invalid EPUB: missing OPF file");

  const opfDoc = parser.parseFromString(opfXml, "application/xml");
  const opfDir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";

  // Get reading order from spine
  const manifest = new Map<string, string>();
  for (const item of Array.from(opfDoc.querySelectorAll("manifest item"))) {
    const id = item.getAttribute("id") || "";
    const href = item.getAttribute("href") || "";
    manifest.set(id, opfDir + href);
  }

  const spineItems = Array.from(opfDoc.querySelectorAll("spine itemref")).map(
    (ref) => ref.getAttribute("idref") || ""
  );

  const sections: string[] = [];
  for (const idref of spineItems) {
    const path = manifest.get(idref);
    if (!path) continue;
    const content = await zip.file(path)?.async("text");
    if (!content) continue;
    const converted = htmlConverter.convertString(content);
    if (converted.markdown.trim()) sections.push(converted.markdown.trim());
  }

  return sections.join("\n\n---\n\n").trim();
}

export class EpubConverter implements DocumentConverter {
  private htmlConverter = new HtmlConverter();

  accepts(file: File, streamInfo: StreamInfo): boolean {
    const ext = (streamInfo.extension || "").toLowerCase();
    const mime = (streamInfo.mimetype || "").toLowerCase();
    if (ACCEPTED_EXTENSIONS.includes(ext)) return true;
    return ACCEPTED_MIMETYPES.some((m) => mime.startsWith(m));
  }

  async convert(file: File, _streamInfo: StreamInfo): Promise<DocumentConverterResult> {
    const arrayBuffer = await file.arrayBuffer();
    const markdown = await epubToMarkdown(arrayBuffer, this.htmlConverter);
    return { markdown };
  }
}
