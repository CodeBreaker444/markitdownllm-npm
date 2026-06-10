<div align="center">

<img src="https://raw.githubusercontent.com/codebreaker444/markitdownllm-npm/77992618244a4b0e25d3923423191986fe72b868/logo.svg" alt="MarkItDown" width="88" height="88" style="border-radius:20px;margin-bottom:12px" />

## MarkItDownLLM

**Browser-native document → Markdown converter for LLM pipelines**

[![npm](https://img.shields.io/npm/v/markitdownllm?style=flat-square&color=6366f1)](https://www.npmjs.com/package/markitdownllm)
[![license](https://img.shields.io/badge/license-MIT-6366f1?style=flat-square)](./LICENSE)
[![tests](https://img.shields.io/badge/tests-58%20passing-22c55e?style=flat-square)](#tests)
[![bundle](https://img.shields.io/badge/bundle-32KB-6366f1?style=flat-square)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square)](https://www.typescriptlang.org/)

</div>

---

`markitdownllm` converts PDF, DOCX, XLSX, PPTX, HTML, CSV, EPUB and more to clean, structured Markdown — **entirely in the browser**, with zero server calls and zero data leaving the device.

Ported from [Microsoft's MarkItDown](https://github.com/microsoft/markitdown) Python library. Same architecture, same converter pipeline, same LLM-optimised output — running natively in any modern browser.

---

## Why Markdown for LLMs?

Markdown is the most token-efficient way to feed structured documents into LLMs:

| Signal | Impact |
| --- | --- |
| **Token reduction** | 20–45% fewer tokens vs unstructured text extraction |
| **Tables** | ~35% fewer tokens than describing the same data in prose |
| **Headings** | LLM skip-scans to relevant sections without reading everything |
| **Training alignment** | GPT-4o, Claude, Gemini are all trained heavily on Markdown — they produce more accurate outputs on structured input |

---

## Quick Start

```bash
npm install markitdownllm
```

> **Note:** PDF conversion requires `pdfjs-dist` as a peer dependency. Copy `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` to your `public/` directory and set `workerSrc` (see [PDF setup](#pdf-setup)).

```typescript
import { MarkItDown } from 'markitdownllm';

const converter = new MarkItDown();

// From a browser File object (drag-and-drop, <input type="file">)
const result = await converter.convert(file);
console.log(result.markdown);
```

---

## Supported Formats

| Format | Extensions | Notes |
| --- | --- | --- |
| PDF | `.pdf` | Text extraction with table detection |
| Word | `.docx` | Headings, lists, tables, images (via mammoth) |
| Excel | `.xlsx`, `.xls` | Multi-sheet, aligned GFM tables |
| PowerPoint | `.pptx` | Slides, speaker notes, embedded tables, image captions |
| HTML | `.html`, `.htm` | Main content extraction, full GFM output |
| CSV / TSV | `.csv`, `.tsv` | GFM table with separator row |
| EPUB | `.epub` | Spine traversal, chapter-by-chapter extraction |
| Plain text | `.txt`, `.md`, `.rst` | Passthrough |

---

## API

### `new MarkItDown(options?)`

```typescript
import { MarkItDown } from 'markitdownllm';

const converter = new MarkItDown({
  // Optional: enable AI image captioning for PPTX embedded images
  llmConfig: {
    provider: 'anthropic',       // 'anthropic' | 'openai'
    apiKey: 'sk-ant-...',
    model: 'claude-haiku-4-5-20251001', // optional, defaults to fastest model
  },
  // Optional: custom mammoth style map for DOCX
  docxStyleMap: `
    p[style-name='Custom Heading'] => h2:fresh
  `,
});

const result = await converter.convert(file);
// result.markdown — clean, LLM-ready Markdown string
```

### `converter.convert(file: File): Promise<DocumentConverterResult>`

Converts a browser `File` object to Markdown. The correct converter is selected automatically based on file extension and MIME type. Falls back to the next converter on error.

```typescript
const result = await converter.convert(file);
console.log(result.markdown); // GFM Markdown string
```

### `converter.register(converter, priority)`

Register a custom converter. Lower priority = tried first.

```typescript
import { MarkItDown, PRIORITY_SPECIFIC } from 'markitdownllm';

const md = new MarkItDown();
md.register(
  {
    accepts: (file, info) => info.extension === '.custom',
    convert: async (file, info) => ({
      markdown: `Custom output for ${file.name}`,
    }),
  },
  PRIORITY_SPECIFIC
);
```

### Individual Converters

All converters are exported and can be used directly:

```typescript
import {
  PdfConverter,
  DocxConverter,
  XlsxConverter,
  XlsConverter,
  PptxConverter,
  HtmlConverter,
  CsvConverter,
  EpubConverter,
  PlainTextConverter,
} from 'markitdownllm';

const pdfConverter = new PdfConverter();
const result = await pdfConverter.convert(file, { extension: '.pdf' });
```

### `captionImage(bytes, mimeType, llmConfig, prompt?)`

Caption an image using an LLM vision API. Used internally by the PPTX converter when `llmConfig` is set.

```typescript
import { captionImage } from 'markitdownllm';

const caption = await captionImage(imageBytes, 'image/png', {
  provider: 'anthropic',
  apiKey: 'sk-ant-...',
});
```

### `normalizeWhitespace(text)`

Post-processor applied to all converter output: strips trailing spaces per line, collapses 3+ blank lines to 2, trims document edges.

```typescript
import { normalizeWhitespace } from 'markitdownllm';
const clean = normalizeWhitespace(rawText);
```

---

## LLM Image Captioning

When `llmConfig` is provided, the PPTX converter sends embedded images to an LLM vision API and uses the response as alt text. Supports both **Anthropic** and **OpenAI**.

```typescript
const converter = new MarkItDown({
  llmConfig: {
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: 'claude-sonnet-4-6', // better quality captions
  },
});

const result = await converter.convert(pptxFile);
// Images become: ![AI-generated description of the chart](slide1_image.png)
```

| Provider | Default model | Notes |
| --- | --- | --- |
| `anthropic` | `claude-haiku-4-5-20251001` | Fast and cheap |
| `openai` | `gpt-4o-mini` | Widely available |

Without `llmConfig`, images fall back to embedded alt text or filename: `![image_name.png](image_name.png)`.

---

## PDF Setup

PDF conversion uses `pdfjs-dist` as a peer dependency. The worker file must be served as a static asset.

```bash
npm install pdfjs-dist
```

**Vite / React:**
```typescript
// vite.config.ts
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default {
  plugins: [
    viteStaticCopy({
      targets: [{ src: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs', dest: '' }],
    }),
  ],
};
```

**Next.js:**
```bash
# Copy worker to public directory
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/
```

```typescript
import { PdfConverter } from 'markitdownllm';
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
```

---

## Architecture

`markitdownllm` mirrors the Python MarkItDown architecture exactly:

```
MarkItDown
├── converter registry (priority-sorted)
├── getStreamInfo()  — detects MIME type and extension from File
├── convert(file)    — dispatches to first accepting converter
│   └── normalizeWhitespace() applied to all output
│
├── PdfConverter     — pdfjs-dist, spatial table detection
├── DocxConverter    — mammoth + style_map + HtmlConverter
├── XlsxConverter    — SheetJS AOA → GFM tables directly
├── XlsConverter     — SheetJS (xlrd engine)
├── PptxConverter    — JSZip + XML parse, shape sort, LLM image captions
├── EpubConverter    — JSZip + OPF spine traversal + HtmlConverter
├── HtmlConverter    — Turndown + @joplin/turndown-plugin-gfm
├── CsvConverter     — native CSV parser → GFM table
└── PlainTextConverter — passthrough
```

### Converter Interface

```typescript
interface DocumentConverter {
  accepts(file: File, streamInfo: StreamInfo): boolean;
  convert(file: File, streamInfo: StreamInfo): Promise<DocumentConverterResult>;
}

interface DocumentConverterResult {
  markdown: string;
  title?: string;
}

interface StreamInfo {
  mimetype?: string;
  extension?: string;
  filename?: string;
  charset?: string;
}
```

---

## Tests

```bash
npm test              # run all tests
npm run test:watch    # watch mode
npm run test:coverage # coverage report
```

```
 ✓ tests/post-process.test.ts  (8 tests)
 ✓ tests/plain-text.test.ts    (7 tests)
 ✓ tests/csv.test.ts           (10 tests)
 ✓ tests/html.test.ts          (16 tests)
 ✓ tests/xlsx.test.ts          (7 tests)
 ✓ tests/markitdown.test.ts    (10 tests)

 Tests  58 passed (58)
```

---

## Related

- [MarkItDown Python](https://github.com/microsoft/markitdown) — the original Python library this is ported from
- [markitdownllm Next.js app](https://markitdownllm.com) — ready-to-use drag-and-drop UI built on this package

---

## License

MIT © 2026
