import type {
  DocumentConverter,
  DocumentConverterResult,
  StreamInfo,
  ConverterRegistration,
} from "./converters/types";
import { PRIORITY_SPECIFIC, PRIORITY_GENERIC } from "./converters/types";
import { PlainTextConverter } from "./converters/plain-text";
import { HtmlConverter } from "./converters/html";
import { CsvConverter } from "./converters/csv";
import { DocxConverter } from "./converters/docx";
import { XlsxConverter, XlsConverter } from "./converters/xlsx";
import { PptxConverter } from "./converters/pptx";
import { PdfConverter } from "./converters/pdf";
import { EpubConverter } from "./converters/epub";
import { normalizeWhitespace } from "./post-process";
import type { LLMConfig } from "./llm-client";

const EXT_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".html": "text/html",
  ".htm": "text/html",
  ".csv": "text/csv",
  ".tsv": "text/tab-separated-values",
  ".epub": "application/epub+zip",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".rst": "text/x-rst",
};

export interface MarkItDownOptions {
  llmConfig?: LLMConfig;
  docxStyleMap?: string;
}

function getStreamInfo(file: File): StreamInfo {
  const name = file.name || "";
  const extMatch = name.match(/(\.[^.]+)$/);
  const extension = extMatch ? extMatch[1].toLowerCase() : "";
  const mimetype = file.type || EXT_TO_MIME[extension] || "application/octet-stream";
  return { mimetype, extension, filename: name };
}

export class MarkItDown {
  private converters: ConverterRegistration[] = [];

  constructor(options: MarkItDownOptions = {}) {
    const { llmConfig, docxStyleMap } = options;

    this.register(new PdfConverter(), PRIORITY_SPECIFIC);
    this.register(new DocxConverter(docxStyleMap), PRIORITY_SPECIFIC);
    this.register(new XlsxConverter(), PRIORITY_SPECIFIC);
    this.register(new XlsConverter(), PRIORITY_SPECIFIC);
    this.register(new PptxConverter(llmConfig), PRIORITY_SPECIFIC);
    this.register(new EpubConverter(), PRIORITY_SPECIFIC);
    this.register(new CsvConverter(), PRIORITY_SPECIFIC);
    this.register(new HtmlConverter(), PRIORITY_SPECIFIC);
    this.register(new PlainTextConverter(), PRIORITY_GENERIC);
  }

  register(converter: DocumentConverter, priority: number): void {
    this.converters.push({ converter, priority });
    this.converters.sort((a, b) => a.priority - b.priority);
  }

  async convert(file: File): Promise<DocumentConverterResult> {
    const streamInfo = getStreamInfo(file);

    for (const { converter } of this.converters) {
      if (converter.accepts(file, streamInfo)) {
        try {
          const result = await converter.convert(file, streamInfo);
          return { ...result, markdown: normalizeWhitespace(result.markdown) };
        } catch (err) {
          console.warn(`Converter ${converter.constructor.name} failed:`, err);
        }
      }
    }

    throw new Error(`No converter found for file: ${file.name}`);
  }

  getSupportedExtensions(): string[] {
    return Object.keys(EXT_TO_MIME).sort();
  }
}
