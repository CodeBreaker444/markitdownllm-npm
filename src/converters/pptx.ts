import type { DocumentConverter, DocumentConverterResult, StreamInfo } from "./types";
import { HtmlConverter } from "./html";
import type { LLMConfig } from "../llm-client";

const ACCEPTED_EXTENSIONS = [".pptx"];
const ACCEPTED_MIMETYPES = [
  "application/vnd.openxmlformats-officedocument.presentationml",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

// Mirrors python-pptx logic: iterate slides, extract shapes in top→left order
async function pptxToMarkdown(
  arrayBuffer: ArrayBuffer,
  htmlConverter: HtmlConverter,
  llmConfig?: LLMConfig
): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(arrayBuffer);

  const presXml = await zip.file("ppt/presentation.xml")?.async("text");
  if (!presXml) throw new Error("Invalid PPTX: missing presentation.xml");

  const parser = new DOMParser();
  const presDoc = parser.parseFromString(presXml, "application/xml");
  const sldIdLst = presDoc.querySelector("sldIdLst");
  const slideIds = sldIdLst ? Array.from(sldIdLst.querySelectorAll("sldId")) : [];

  const presRelsXml = await zip.file("ppt/_rels/presentation.xml.rels")?.async("text");
  const relsDoc = presRelsXml
    ? parser.parseFromString(presRelsXml, "application/xml")
    : null;

  const rIdToPath: Record<string, string> = {};
  if (relsDoc) {
    for (const rel of Array.from(relsDoc.querySelectorAll("Relationship"))) {
      const id = rel.getAttribute("Id") || "";
      const target = rel.getAttribute("Target") || "";
      rIdToPath[id] = target.startsWith("/") ? target.slice(1) : `ppt/${target}`;
    }
  }

  const slides: string[] = [];
  let slideNum = 0;

  for (const sldId of slideIds) {
    const rId =
      sldId.getAttribute("r:id") ||
      sldId.getAttributeNS(
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "id"
      ) ||
      "";

    const slidePath = rIdToPath[rId];
    if (!slidePath) continue;

    const slideXml = await zip.file(slidePath)?.async("text");
    if (!slideXml) continue;

    slideNum++;
    const slideDoc = parser.parseFromString(slideXml, "application/xml");
    let md = `\n\n<!-- Slide number: ${slideNum} -->\n`;

    const spTree = slideDoc.querySelector("spTree");
    if (!spTree) {
      slides.push(md.trim());
      continue;
    }

    // Build image rels map for this slide
    const slideRelsPath = slidePath
      .replace("ppt/slides/", "ppt/slides/_rels/")
      + ".rels";
    const slideRelsXml = await zip.file(slideRelsPath)?.async("text");
    const imageRels: Record<string, string> = {};
    let notesPath: string | null = null;

    if (slideRelsXml) {
      const slideRelsDoc = parser.parseFromString(slideRelsXml, "application/xml");
      for (const rel of Array.from(slideRelsDoc.querySelectorAll("Relationship"))) {
        const type = rel.getAttribute("Type") || "";
        const target = rel.getAttribute("Target") || "";
        const relId = rel.getAttribute("Id") || "";
        if (type.includes("/image")) {
          const imgPath = target.startsWith("../")
            ? `ppt/slides/${target}`.replace(/\/[^/]+\/\.\.\//, "/")
            : `ppt/slides/${target}`;
          imageRels[relId] = imgPath;
        }
        if (type.includes("notesSlide")) {
          notesPath = target.startsWith("../")
            ? `ppt/slides/${target}`.replace(/\/[^/]+\/\.\.\//, "/")
            : `ppt/slides/${target}`;
        }
      }
    }

    const shapes = Array.from(spTree.children).filter(
      (el) => el.tagName !== "nvGrpSpPr" && el.tagName !== "grpSpPr"
    );

    const getSortKey = (el: Element): [number, number] => {
      const xfrm = el.querySelector("xfrm") || el.querySelector("*|xfrm");
      const off = xfrm?.querySelector("off") || xfrm?.querySelector("*|off");
      const y = parseFloat(off?.getAttribute("y") || "0") || 0;
      const x = parseFloat(off?.getAttribute("x") || "0") || 0;
      return [y, x];
    };

    shapes.sort((a, b) => {
      const [ay, ax] = getSortKey(a);
      const [by, bx] = getSortKey(b);
      return ay !== by ? ay - by : ax - bx;
    });

    for (const shape of shapes) {
      md += await extractShapeContent(shape, zip, imageRels, llmConfig);
    }

    // Speaker notes
    if (notesPath) {
      const notesXml = await zip.file(notesPath)?.async("text");
      if (notesXml) {
        const notesDoc = parser.parseFromString(notesXml, "application/xml");
        const notesText = extractTextFromDoc(notesDoc);
        if (notesText.trim()) md += `\n\n### Notes:\n${notesText}`;
      }
    }

    slides.push(md.trim());
  }

  return slides.join("\n\n").trim();
}

function extractTextFromDoc(doc: Document): string {
  return Array.from(doc.querySelectorAll("p"))
    .map((p) =>
      Array.from(p.querySelectorAll("r, t"))
        .map((r) => (r.tagName === "t" ? r : r.querySelector("t"))?.textContent || "")
        .join("")
    )
    .join("\n");
}

async function extractShapeContent(
  shape: Element,
  zip: import("jszip"),
  imageRels: Record<string, string>,
  llmConfig?: LLMConfig
): Promise<string> {
  let content = "";

  // Tables
  const tbl = shape.querySelector("tbl");
  if (tbl) return tableToMarkdown(tbl) + "\n";

  // Pictures — blipFill with rEmbed ref
  const blipFill = shape.querySelector("blipFill");
  const blip = blipFill?.querySelector("blip");
  const embedRId =
    blip?.getAttribute("r:embed") ||
    blip?.getAttributeNS(
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "embed"
    );

  if (embedRId && imageRels[embedRId]) {
    const imgPath = imageRels[embedRId];
    const ext = imgPath.split(".").pop()?.toLowerCase() || "png";
    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
      gif: "image/gif", bmp: "image/bmp", webp: "image/webp",
    };
    const mime = mimeMap[ext] || "image/png";

    // Get embedded alt text
    const nvPr = shape.querySelector("cNvPr");
    const altText = nvPr?.getAttribute("descr") || nvPr?.getAttribute("title") || "";

    let description = altText;

    // LLM captioning if configured
    if (llmConfig?.apiKey) {
      try {
        const { captionImage } = await import("../llm-client");
        const imgBytes = await zip.file(imgPath)?.async("uint8array");
        if (imgBytes) {
          description = await captionImage(imgBytes, mime, llmConfig);
        }
      } catch (err) {
        console.warn("LLM image caption failed:", err);
        description = altText;
      }
    }

    // Sanitize alt text (mirrors Python: strip \r\n[])
    const safeAlt = (description || shape.getAttribute("name") || "image")
      .replace(/[\r\n[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const filename = `${(shape.getAttribute("name") || "image").replace(/\W/g, "")}.${ext}`;
    return `\n![${safeAlt}](${filename})\n`;
  }

  // Text frames
  const txBody = shape.querySelector("txBody");
  if (txBody) {
    const ph = shape.querySelector("ph");
    const phType = ph?.getAttribute("type") || "";

    // Heading level mirrors python-pptx shape classification:
    // title/ctrTitle → h1, subTitle → h2, body paragraphs use outline level
    const isTitle = phType === "title" || phType === "ctrTitle";
    const isSubtitle = phType === "subTitle";
    const isBody = phType === "body" || phType === "";

    const paras = Array.from(txBody.querySelectorAll("p"));

    for (const p of paras) {
      const runs = Array.from(p.querySelectorAll("r"));
      const text = runs.map((r) => r.querySelector("t")?.textContent || "").join("").trim();
      if (!text) continue;

      if (isTitle) {
        content += `# ${text}\n`;
      } else if (isSubtitle) {
        content += `## ${text}\n`;
      } else if (isBody) {
        // Use outline level (lvl attr on pPr) for heading hierarchy
        // lvl=0 + short single-line → treat as h2; deeper levels → h3+
        const pPr = p.querySelector("pPr");
        const lvl = parseInt(pPr?.getAttribute("lvl") || "0", 10);
        const hasBullet =
          pPr?.querySelector("buChar") !== null ||
          pPr?.querySelector("buAutoNum") !== null;
        const isHeadingLike = !hasBullet && text.length <= 120 && runs.length <= 5;

        if (isHeadingLike && lvl === 0 && paras.length === 1) {
          // Single short paragraph in a body frame, no bullet → likely a heading
          content += `## ${text}\n`;
        } else if (hasBullet) {
          const indent = "  ".repeat(lvl);
          content += `${indent}- ${text}\n`;
        } else {
          content += `${text}\n`;
        }
      } else {
        content += `${text}\n`;
      }
    }
  }

  return content;
}

function extractCellText(cell: Element): string {
  // Concatenate all run texts within a cell, joining paragraphs with space
  const paras = Array.from(cell.querySelectorAll("p"));
  return paras
    .map((p) =>
      Array.from(p.querySelectorAll("r"))
        .map((r) => r.querySelector("t")?.textContent || "")
        .join("")
    )
    .filter((t) => t.trim())
    .join(" ")
    .trim();
}

function tableToMarkdown(tbl: Element): string {
  const rows = Array.from(tbl.querySelectorAll("tr"));
  if (!rows.length) return "";

  const tableData = rows.map((row) =>
    Array.from(row.querySelectorAll("tc")).map(extractCellText)
  );

  if (!tableData.length) return "";

  const colCount = Math.max(...tableData.map((r) => r.length));

  // Pad rows to same width
  const padded = tableData.map((row) => {
    while (row.length < colCount) row.push("");
    return row;
  });

  // Detect blank spacer columns (PPTX uses empty columns for visual spacing)
  const blankCol = Array.from({ length: colCount }, (_, i) =>
    padded.every((row) => !row[i].trim())
  );

  const filtered = padded.map((row) => row.filter((_, i) => !blankCol[i]));
  if (!filtered.length || !filtered[0].length) return "";

  // Detect layout tables: cells contain long prose (>150 chars avg) or
  // most rows have only 1-2 non-empty cells → render as structured text, not a table
  const nonEmptyPerRow = filtered.map((row) => row.filter((c) => c.trim()).length);
  const avgNonEmpty = nonEmptyPerRow.reduce((s, n) => s + n, 0) / filtered.length;
  const maxCellLen = Math.max(...filtered.flatMap((row) => row.map((c) => c.length)));

  if (maxCellLen > 200 || avgNonEmpty < 1.5) {
    // Layout/prose table: render as labeled paragraphs instead
    const lines: string[] = [];
    for (const row of filtered) {
      const cells = row.filter((c) => c.trim());
      if (!cells.length) continue;
      if (cells.length === 1) {
        lines.push(cells[0]);
      } else if (cells.length === 2) {
        // Key: value pattern
        lines.push(`**${cells[0]}** ${cells[1]}`);
      } else {
        lines.push(cells.join(" — "));
      }
    }
    return lines.join("\n\n") + "\n";
  }

  // Escape pipe chars inside cells
  const safe = filtered.map((row) =>
    row.map((c) => c.replace(/\|/g, "\\|").replace(/\n/g, " "))
  );

  const colWidths = Array.from({ length: safe[0].length }, (_, i) =>
    Math.max(3, ...safe.map((r) => (r[i] || "").length))
  );

  const fmt = (row: string[]) =>
    "| " + row.map((c, i) => (c || "").padEnd(colWidths[i])).join(" | ") + " |";
  const sep = "| " + colWidths.map((w) => "-".repeat(w)).join(" | ") + " |";

  const [header, ...data] = safe;
  return [fmt(header), sep, ...data.map(fmt)].join("\n") + "\n";
}

export class PptxConverter implements DocumentConverter {
  private htmlConverter = new HtmlConverter();
  private llmConfig?: LLMConfig;

  constructor(llmConfig?: LLMConfig) {
    this.llmConfig = llmConfig;
  }

  accepts(file: File, streamInfo: StreamInfo): boolean {
    const ext = (streamInfo.extension || "").toLowerCase();
    const mime = (streamInfo.mimetype || "").toLowerCase();
    if (ACCEPTED_EXTENSIONS.includes(ext)) return true;
    return ACCEPTED_MIMETYPES.some((m) => mime.startsWith(m));
  }

  async convert(file: File, _streamInfo: StreamInfo): Promise<DocumentConverterResult> {
    const arrayBuffer = await file.arrayBuffer();
    const markdown = await pptxToMarkdown(arrayBuffer, this.htmlConverter, this.llmConfig);
    return { markdown };
  }
}
