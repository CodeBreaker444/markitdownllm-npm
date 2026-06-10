export interface StreamInfo {
  mimetype?: string;
  extension?: string;
  filename?: string;
  charset?: string;
}

export interface DocumentConverterResult {
  markdown: string;
  title?: string;
}

export interface DocumentConverter {
  accepts(file: File, streamInfo: StreamInfo): boolean;
  convert(
    file: File,
    streamInfo: StreamInfo
  ): Promise<DocumentConverterResult>;
}

export const PRIORITY_SPECIFIC = 0.0;
export const PRIORITY_GENERIC = 10.0;

export interface ConverterRegistration {
  converter: DocumentConverter;
  priority: number;
}
