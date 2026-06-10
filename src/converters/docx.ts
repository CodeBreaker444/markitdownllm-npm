import type { DocumentConverter, DocumentConverterResult, StreamInfo } from "./types";
import { HtmlConverter } from "./html";

const ACCEPTED_EXTENSIONS = [".docx"];
const ACCEPTED_MIMETYPES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// Mirrors Python mammoth style_map defaults — maps Word paragraph styles to HTML.
// mammoth already handles Heading 1-6, but custom/non-standard styles need explicit mapping.
const DEFAULT_STYLE_MAP = `
p[style-name='Title'] => h1:fresh
p[style-name='Subtitle'] => h2:fresh
p[style-name='Heading 1'] => h1:fresh
p[style-name='Heading 2'] => h2:fresh
p[style-name='Heading 3'] => h3:fresh
p[style-name='Heading 4'] => h4:fresh
p[style-name='Heading 5'] => h5:fresh
p[style-name='Heading 6'] => h6:fresh
p[style-name='List Paragraph'] => p:fresh
r[style-name='Strong'] => strong
r[style-name='Emphasis'] => em
r[style-name='Code'] => code
p[style-name='Code'] => pre:fresh
p[style-name='Intense Quote'] => blockquote:fresh
p[style-name='Quote'] => blockquote:fresh
`.trim();

export class DocxConverter implements DocumentConverter {
  private htmlConverter = new HtmlConverter();
  private styleMap: string;

  constructor(styleMap?: string) {
    this.styleMap = styleMap ?? DEFAULT_STYLE_MAP;
  }

  accepts(file: File, streamInfo: StreamInfo): boolean {
    const ext = (streamInfo.extension || "").toLowerCase();
    const mime = (streamInfo.mimetype || "").toLowerCase();
    if (ACCEPTED_EXTENSIONS.includes(ext)) return true;
    return ACCEPTED_MIMETYPES.some((m) => mime.startsWith(m));
  }

  async convert(file: File, _streamInfo: StreamInfo): Promise<DocumentConverterResult> {
    const mammoth = await import("mammoth");
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml(
      { arrayBuffer },
      { styleMap: this.styleMap }
    );
    return this.htmlConverter.convertString(result.value);
  }
}
