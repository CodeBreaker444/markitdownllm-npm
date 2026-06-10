interface StreamInfo {
    mimetype?: string;
    extension?: string;
    filename?: string;
    charset?: string;
}
interface DocumentConverterResult {
    markdown: string;
    title?: string;
}
interface DocumentConverter {
    accepts(file: File, streamInfo: StreamInfo): boolean;
    convert(file: File, streamInfo: StreamInfo): Promise<DocumentConverterResult>;
}
declare const PRIORITY_SPECIFIC = 0;
declare const PRIORITY_GENERIC = 10;
interface ConverterRegistration {
    converter: DocumentConverter;
    priority: number;
}

type LLMProvider = "anthropic" | "openai";
interface LLMConfig {
    provider: LLMProvider;
    apiKey: string;
    model?: string;
}
declare function captionImage(imageBytes: Uint8Array, mimeType: string, config: LLMConfig, prompt?: string): Promise<string>;

interface MarkItDownOptions {
    llmConfig?: LLMConfig;
    docxStyleMap?: string;
}
declare class MarkItDown {
    private converters;
    constructor(options?: MarkItDownOptions);
    register(converter: DocumentConverter, priority: number): void;
    convert(file: File): Promise<DocumentConverterResult>;
    getSupportedExtensions(): string[];
}

declare class PlainTextConverter implements DocumentConverter {
    accepts(file: File, streamInfo: StreamInfo): boolean;
    convert(file: File, streamInfo: StreamInfo): Promise<DocumentConverterResult>;
}

declare class HtmlConverter implements DocumentConverter {
    accepts(file: File, streamInfo: StreamInfo): boolean;
    convert(file: File, _streamInfo: StreamInfo): Promise<DocumentConverterResult>;
    convertString(html: string): DocumentConverterResult;
}

declare class CsvConverter implements DocumentConverter {
    accepts(file: File, streamInfo: StreamInfo): boolean;
    convert(file: File, streamInfo: StreamInfo): Promise<DocumentConverterResult>;
}

declare class DocxConverter implements DocumentConverter {
    private htmlConverter;
    private styleMap;
    constructor(styleMap?: string);
    accepts(file: File, streamInfo: StreamInfo): boolean;
    convert(file: File, _streamInfo: StreamInfo): Promise<DocumentConverterResult>;
}

declare class XlsxConverter implements DocumentConverter {
    accepts(file: File, streamInfo: StreamInfo): boolean;
    convert(file: File, _streamInfo: StreamInfo): Promise<DocumentConverterResult>;
}
declare class XlsConverter implements DocumentConverter {
    accepts(file: File, streamInfo: StreamInfo): boolean;
    convert(file: File, _streamInfo: StreamInfo): Promise<DocumentConverterResult>;
}

declare class PptxConverter implements DocumentConverter {
    private htmlConverter;
    private llmConfig?;
    constructor(llmConfig?: LLMConfig);
    accepts(file: File, streamInfo: StreamInfo): boolean;
    convert(file: File, _streamInfo: StreamInfo): Promise<DocumentConverterResult>;
}

declare class PdfConverter implements DocumentConverter {
    accepts(file: File, streamInfo: StreamInfo): boolean;
    convert(file: File, _streamInfo: StreamInfo): Promise<DocumentConverterResult>;
}

declare class EpubConverter implements DocumentConverter {
    private htmlConverter;
    accepts(file: File, streamInfo: StreamInfo): boolean;
    convert(file: File, _streamInfo: StreamInfo): Promise<DocumentConverterResult>;
}

declare function normalizeWhitespace(text: string): string;

export { type ConverterRegistration, CsvConverter, type DocumentConverter, type DocumentConverterResult, DocxConverter, EpubConverter, HtmlConverter, type LLMConfig, type LLMProvider, MarkItDown, type MarkItDownOptions, PRIORITY_GENERIC, PRIORITY_SPECIFIC, PdfConverter, PlainTextConverter, PptxConverter, type StreamInfo, XlsConverter, XlsxConverter, captionImage, normalizeWhitespace };
