'use strict';

var TurndownService = require('turndown');
var turndownPluginGfm = require('@joplin/turndown-plugin-gfm');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var TurndownService__default = /*#__PURE__*/_interopDefault(TurndownService);

var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/llm-client.ts
var llm_client_exports = {};
__export(llm_client_exports, {
  captionImage: () => captionImage
});
async function captionImage(imageBytes, mimeType, config, prompt = DEFAULT_PROMPT) {
  const model = config.model || DEFAULT_MODELS[config.provider];
  const b64 = uint8ToBase64(imageBytes);
  if (config.provider === "anthropic") {
    const resp2 = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        max_tokens: 256,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mimeType, data: b64 } },
              { type: "text", text: prompt }
            ]
          }
        ]
      })
    });
    if (!resp2.ok) throw new Error(`Anthropic API ${resp2.status}: ${await resp2.text()}`);
    const data2 = await resp2.json();
    return data2.content?.[0]?.text?.trim() ?? "";
  }
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${b64}` } },
            { type: "text", text: prompt }
          ]
        }
      ]
    })
  });
  if (!resp.ok) throw new Error(`OpenAI API ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}
function uint8ToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
var DEFAULT_MODELS, DEFAULT_PROMPT;
var init_llm_client = __esm({
  "src/llm-client.ts"() {
    DEFAULT_MODELS = {
      anthropic: "claude-haiku-4-5-20251001",
      openai: "gpt-4o-mini"
    };
    DEFAULT_PROMPT = "Write a concise alt-text description of this image for use in a Markdown document. Be specific and factual. One or two sentences.";
  }
});

// src/converters/types.ts
var PRIORITY_SPECIFIC = 0;
var PRIORITY_GENERIC = 10;

// src/converters/plain-text.ts
var ACCEPTED_EXTENSIONS = [".txt", ".md", ".rst", ".log", ".text"];
var ACCEPTED_MIMETYPES = ["text/plain", "text/markdown", "text/x-rst"];
var PlainTextConverter = class {
  accepts(file, streamInfo) {
    const ext = (streamInfo.extension || "").toLowerCase();
    const mime = (streamInfo.mimetype || "").toLowerCase();
    if (ACCEPTED_EXTENSIONS.includes(ext)) return true;
    return ACCEPTED_MIMETYPES.some((m) => mime.startsWith(m));
  }
  async convert(file, streamInfo) {
    streamInfo.charset || "utf-8";
    const text = await file.text();
    return { markdown: text };
  }
};
var ACCEPTED_EXTENSIONS2 = [".html", ".htm"];
var ACCEPTED_MIMETYPES2 = ["text/html", "application/xhtml"];
function buildTurndown() {
  const td = new TurndownService__default.default({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-"
  });
  td.use(turndownPluginGfm.gfm);
  td.remove(["script", "style", "noscript", "head"]);
  return td;
}
function htmlToMarkdown(html) {
  const td = buildTurndown();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const main = doc.querySelector("main") || doc.querySelector("article") || doc.querySelector('[role="main"]') || doc.querySelector("#main-content") || doc.body;
  const source = main?.innerHTML ?? html;
  return td.turndown(source).trim();
}
var HtmlConverter = class {
  accepts(file, streamInfo) {
    const ext = (streamInfo.extension || "").toLowerCase();
    const mime = (streamInfo.mimetype || "").toLowerCase();
    if (ACCEPTED_EXTENSIONS2.includes(ext)) return true;
    return ACCEPTED_MIMETYPES2.some((m) => mime.startsWith(m));
  }
  async convert(file, _streamInfo) {
    const html = await file.text();
    return { markdown: htmlToMarkdown(html) };
  }
  convertString(html) {
    return { markdown: htmlToMarkdown(html) };
  }
};

// src/converters/csv.ts
var ACCEPTED_EXTENSIONS3 = [".csv", ".tsv"];
var ACCEPTED_MIMETYPES3 = ["text/csv", "application/csv", "text/tab-separated-values"];
function parseCSV(content, delimiter = ",") {
  const rows = [];
  let inQuote = false;
  let cur = "";
  let row = [];
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
    } else if (ch === "\n" || ch === "\r" && next === "\n") {
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
function rowsToMarkdown(rows) {
  if (!rows.length) return "";
  const header = rows[0];
  const lines = [
    "| " + header.join(" | ") + " |",
    "| " + header.map(() => "---").join(" | ") + " |",
    ...rows.slice(1).map((row) => {
      while (row.length < header.length) row.push("");
      return "| " + row.slice(0, header.length).join(" | ") + " |";
    })
  ];
  return lines.join("\n");
}
var CsvConverter = class {
  accepts(file, streamInfo) {
    const ext = (streamInfo.extension || "").toLowerCase();
    const mime = (streamInfo.mimetype || "").toLowerCase();
    if (ACCEPTED_EXTENSIONS3.includes(ext)) return true;
    return ACCEPTED_MIMETYPES3.some((m) => mime.startsWith(m));
  }
  async convert(file, streamInfo) {
    const text = await file.text();
    const ext = (streamInfo.extension || "").toLowerCase();
    const delimiter = ext === ".tsv" ? "	" : ",";
    const rows = parseCSV(text, delimiter);
    return { markdown: rowsToMarkdown(rows) };
  }
};

// src/converters/docx.ts
var ACCEPTED_EXTENSIONS4 = [".docx"];
var ACCEPTED_MIMETYPES4 = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];
var DEFAULT_STYLE_MAP = `
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
var DocxConverter = class {
  constructor(styleMap) {
    this.htmlConverter = new HtmlConverter();
    this.styleMap = styleMap ?? DEFAULT_STYLE_MAP;
  }
  accepts(file, streamInfo) {
    const ext = (streamInfo.extension || "").toLowerCase();
    const mime = (streamInfo.mimetype || "").toLowerCase();
    if (ACCEPTED_EXTENSIONS4.includes(ext)) return true;
    return ACCEPTED_MIMETYPES4.some((m) => mime.startsWith(m));
  }
  async convert(file, _streamInfo) {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml(
      { arrayBuffer },
      { styleMap: this.styleMap }
    );
    return this.htmlConverter.convertString(result.value);
  }
};

// src/converters/xlsx.ts
var ACCEPTED_XLSX_EXTENSIONS = [".xlsx"];
var ACCEPTED_XLS_EXTENSIONS = [".xls"];
var ACCEPTED_XLSX_MIMETYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
];
var ACCEPTED_XLS_MIMETYPES = ["application/vnd.ms-excel", "application/excel"];
function aoa_to_markdown(rows) {
  while (rows.length && rows[rows.length - 1].every((c) => c === "" || c == null)) {
    rows.pop();
  }
  if (!rows.length) return "";
  const str = rows.map((row) => row.map((c) => String(c ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ")));
  const cols = Math.max(...str.map((r) => r.length));
  const padded = str.map((row) => {
    while (row.length < cols) row.push("");
    return row;
  });
  const widths = Array.from(
    { length: cols },
    (_, i) => Math.max(3, ...padded.map((r) => r[i].length))
  );
  const fmt = (row) => "| " + row.map((c, i) => c.padEnd(widths[i])).join(" | ") + " |";
  const sep = "| " + widths.map((w) => "-".repeat(w)).join(" | ") + " |";
  const [header, ...data] = padded;
  const lines = [fmt(header), sep, ...data.map(fmt)];
  return lines.join("\n");
}
async function sheetsToMarkdown(arrayBuffer) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const sections = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
      blankrows: false
    });
    if (!rows.length) continue;
    const table = aoa_to_markdown(rows);
    if (table) sections.push(`## ${sheetName}

${table}`);
  }
  return sections.join("\n\n");
}
var XlsxConverter = class {
  accepts(file, streamInfo) {
    const ext = (streamInfo.extension || "").toLowerCase();
    const mime = (streamInfo.mimetype || "").toLowerCase();
    if (ACCEPTED_XLSX_EXTENSIONS.includes(ext)) return true;
    return ACCEPTED_XLSX_MIMETYPES.some((m) => mime.startsWith(m));
  }
  async convert(file, _streamInfo) {
    const arrayBuffer = await file.arrayBuffer();
    return { markdown: await sheetsToMarkdown(arrayBuffer) };
  }
};
var XlsConverter = class {
  accepts(file, streamInfo) {
    const ext = (streamInfo.extension || "").toLowerCase();
    const mime = (streamInfo.mimetype || "").toLowerCase();
    if (ACCEPTED_XLS_EXTENSIONS.includes(ext)) return true;
    return ACCEPTED_XLS_MIMETYPES.some((m) => mime.startsWith(m));
  }
  async convert(file, _streamInfo) {
    const arrayBuffer = await file.arrayBuffer();
    return { markdown: await sheetsToMarkdown(arrayBuffer) };
  }
};

// src/converters/pptx.ts
var ACCEPTED_EXTENSIONS5 = [".pptx"];
var ACCEPTED_MIMETYPES5 = [
  "application/vnd.openxmlformats-officedocument.presentationml",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation"
];
async function pptxToMarkdown(arrayBuffer, htmlConverter, llmConfig) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(arrayBuffer);
  const presXml = await zip.file("ppt/presentation.xml")?.async("text");
  if (!presXml) throw new Error("Invalid PPTX: missing presentation.xml");
  const parser = new DOMParser();
  const presDoc = parser.parseFromString(presXml, "application/xml");
  const sldIdLst = presDoc.querySelector("sldIdLst");
  const slideIds = sldIdLst ? Array.from(sldIdLst.querySelectorAll("sldId")) : [];
  const presRelsXml = await zip.file("ppt/_rels/presentation.xml.rels")?.async("text");
  const relsDoc = presRelsXml ? parser.parseFromString(presRelsXml, "application/xml") : null;
  const rIdToPath = {};
  if (relsDoc) {
    for (const rel of Array.from(relsDoc.querySelectorAll("Relationship"))) {
      const id = rel.getAttribute("Id") || "";
      const target = rel.getAttribute("Target") || "";
      rIdToPath[id] = target.startsWith("/") ? target.slice(1) : `ppt/${target}`;
    }
  }
  const slides = [];
  let slideNum = 0;
  for (const sldId of slideIds) {
    const rId = sldId.getAttribute("r:id") || sldId.getAttributeNS(
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "id"
    ) || "";
    const slidePath = rIdToPath[rId];
    if (!slidePath) continue;
    const slideXml = await zip.file(slidePath)?.async("text");
    if (!slideXml) continue;
    slideNum++;
    const slideDoc = parser.parseFromString(slideXml, "application/xml");
    let md = `

<!-- Slide number: ${slideNum} -->
`;
    const spTree = slideDoc.querySelector("spTree");
    if (!spTree) {
      slides.push(md.trim());
      continue;
    }
    const slideRelsPath = slidePath.replace("ppt/slides/", "ppt/slides/_rels/") + ".rels";
    const slideRelsXml = await zip.file(slideRelsPath)?.async("text");
    const imageRels = {};
    let notesPath = null;
    if (slideRelsXml) {
      const slideRelsDoc = parser.parseFromString(slideRelsXml, "application/xml");
      for (const rel of Array.from(slideRelsDoc.querySelectorAll("Relationship"))) {
        const type = rel.getAttribute("Type") || "";
        const target = rel.getAttribute("Target") || "";
        const relId = rel.getAttribute("Id") || "";
        if (type.includes("/image")) {
          const imgPath = target.startsWith("../") ? `ppt/slides/${target}`.replace(/\/[^/]+\/\.\.\//, "/") : `ppt/slides/${target}`;
          imageRels[relId] = imgPath;
        }
        if (type.includes("notesSlide")) {
          notesPath = target.startsWith("../") ? `ppt/slides/${target}`.replace(/\/[^/]+\/\.\.\//, "/") : `ppt/slides/${target}`;
        }
      }
    }
    const shapes = Array.from(spTree.children).filter(
      (el) => el.tagName !== "nvGrpSpPr" && el.tagName !== "grpSpPr"
    );
    const getSortKey = (el) => {
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
    if (notesPath) {
      const notesXml = await zip.file(notesPath)?.async("text");
      if (notesXml) {
        const notesDoc = parser.parseFromString(notesXml, "application/xml");
        const notesText = extractTextFromDoc(notesDoc);
        if (notesText.trim()) md += `

### Notes:
${notesText}`;
      }
    }
    slides.push(md.trim());
  }
  return slides.join("\n\n").trim();
}
function extractTextFromDoc(doc) {
  return Array.from(doc.querySelectorAll("p")).map(
    (p) => Array.from(p.querySelectorAll("r, t")).map((r) => (r.tagName === "t" ? r : r.querySelector("t"))?.textContent || "").join("")
  ).join("\n");
}
async function extractShapeContent(shape, zip, imageRels, llmConfig) {
  let content = "";
  const tbl = shape.querySelector("tbl");
  if (tbl) return tableToMarkdown(tbl) + "\n";
  const blipFill = shape.querySelector("blipFill");
  const blip = blipFill?.querySelector("blip");
  const embedRId = blip?.getAttribute("r:embed") || blip?.getAttributeNS(
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "embed"
  );
  if (embedRId && imageRels[embedRId]) {
    const imgPath = imageRels[embedRId];
    const ext = imgPath.split(".").pop()?.toLowerCase() || "png";
    const mimeMap = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      bmp: "image/bmp",
      webp: "image/webp"
    };
    const mime = mimeMap[ext] || "image/png";
    const nvPr = shape.querySelector("cNvPr");
    const altText = nvPr?.getAttribute("descr") || nvPr?.getAttribute("title") || "";
    let description = altText;
    if (llmConfig?.apiKey) {
      try {
        const { captionImage: captionImage2 } = await Promise.resolve().then(() => (init_llm_client(), llm_client_exports));
        const imgBytes = await zip.file(imgPath)?.async("uint8array");
        if (imgBytes) {
          description = await captionImage2(imgBytes, mime, llmConfig);
        }
      } catch (err) {
        console.warn("LLM image caption failed:", err);
        description = altText;
      }
    }
    const safeAlt = (description || shape.getAttribute("name") || "image").replace(/[\r\n[\]]/g, " ").replace(/\s+/g, " ").trim();
    const filename = `${(shape.getAttribute("name") || "image").replace(/\W/g, "")}.${ext}`;
    return `
![${safeAlt}](${filename})
`;
  }
  const txBody = shape.querySelector("txBody");
  if (txBody) {
    const ph = shape.querySelector("ph");
    const phType = ph?.getAttribute("type") || "";
    const isTitle = phType === "title" || phType === "ctrTitle";
    const isSubtitle = phType === "subTitle";
    const isBody = phType === "body" || phType === "";
    const paras = Array.from(txBody.querySelectorAll("p"));
    for (const p of paras) {
      const runs = Array.from(p.querySelectorAll("r"));
      const text = runs.map((r) => r.querySelector("t")?.textContent || "").join("").trim();
      if (!text) continue;
      if (isTitle) {
        content += `# ${text}
`;
      } else if (isSubtitle) {
        content += `## ${text}
`;
      } else if (isBody) {
        const pPr = p.querySelector("pPr");
        const lvl = parseInt(pPr?.getAttribute("lvl") || "0", 10);
        const hasBullet = pPr?.querySelector("buChar") !== null || pPr?.querySelector("buAutoNum") !== null;
        const isHeadingLike = !hasBullet && text.length <= 120 && runs.length <= 5;
        if (isHeadingLike && lvl === 0 && paras.length === 1) {
          content += `## ${text}
`;
        } else if (hasBullet) {
          const indent = "  ".repeat(lvl);
          content += `${indent}- ${text}
`;
        } else {
          content += `${text}
`;
        }
      } else {
        content += `${text}
`;
      }
    }
  }
  return content;
}
function extractCellText(cell) {
  const paras = Array.from(cell.querySelectorAll("p"));
  return paras.map(
    (p) => Array.from(p.querySelectorAll("r")).map((r) => r.querySelector("t")?.textContent || "").join("")
  ).filter((t) => t.trim()).join(" ").trim();
}
function tableToMarkdown(tbl) {
  const rows = Array.from(tbl.querySelectorAll("tr"));
  if (!rows.length) return "";
  const tableData = rows.map(
    (row) => Array.from(row.querySelectorAll("tc")).map(extractCellText)
  );
  if (!tableData.length) return "";
  const colCount = Math.max(...tableData.map((r) => r.length));
  const padded = tableData.map((row) => {
    while (row.length < colCount) row.push("");
    return row;
  });
  const blankCol = Array.from(
    { length: colCount },
    (_, i) => padded.every((row) => !row[i].trim())
  );
  const filtered = padded.map((row) => row.filter((_, i) => !blankCol[i]));
  if (!filtered.length || !filtered[0].length) return "";
  const nonEmptyPerRow = filtered.map((row) => row.filter((c) => c.trim()).length);
  const avgNonEmpty = nonEmptyPerRow.reduce((s, n) => s + n, 0) / filtered.length;
  const maxCellLen = Math.max(...filtered.flatMap((row) => row.map((c) => c.length)));
  if (maxCellLen > 200 || avgNonEmpty < 1.5) {
    const lines = [];
    for (const row of filtered) {
      const cells = row.filter((c) => c.trim());
      if (!cells.length) continue;
      if (cells.length === 1) {
        lines.push(cells[0]);
      } else if (cells.length === 2) {
        lines.push(`**${cells[0]}** ${cells[1]}`);
      } else {
        lines.push(cells.join(" \u2014 "));
      }
    }
    return lines.join("\n\n") + "\n";
  }
  const safe = filtered.map(
    (row) => row.map((c) => c.replace(/\|/g, "\\|").replace(/\n/g, " "))
  );
  const colWidths = Array.from(
    { length: safe[0].length },
    (_, i) => Math.max(3, ...safe.map((r) => (r[i] || "").length))
  );
  const fmt = (row) => "| " + row.map((c, i) => (c || "").padEnd(colWidths[i])).join(" | ") + " |";
  const sep = "| " + colWidths.map((w) => "-".repeat(w)).join(" | ") + " |";
  const [header, ...data] = safe;
  return [fmt(header), sep, ...data.map(fmt)].join("\n") + "\n";
}
var PptxConverter = class {
  constructor(llmConfig) {
    this.htmlConverter = new HtmlConverter();
    this.llmConfig = llmConfig;
  }
  accepts(file, streamInfo) {
    const ext = (streamInfo.extension || "").toLowerCase();
    const mime = (streamInfo.mimetype || "").toLowerCase();
    if (ACCEPTED_EXTENSIONS5.includes(ext)) return true;
    return ACCEPTED_MIMETYPES5.some((m) => mime.startsWith(m));
  }
  async convert(file, _streamInfo) {
    const arrayBuffer = await file.arrayBuffer();
    const markdown = await pptxToMarkdown(arrayBuffer, this.htmlConverter, this.llmConfig);
    return { markdown };
  }
};

// src/converters/pdf.ts
var ACCEPTED_EXTENSIONS6 = [".pdf"];
var ACCEPTED_MIMETYPES6 = ["application/pdf", "application/x-pdf"];
function cluster(values, gap) {
  const sorted = [...values].sort((a, b) => a - b);
  const centers = [];
  for (const v of sorted) {
    if (!centers.length || v - centers[centers.length - 1] > gap) centers.push(v);
  }
  return centers;
}
function nearAny(x, centers, tolerance) {
  return centers.some((c) => Math.abs(x - c) <= tolerance);
}
function buildRows(items) {
  const Y_TOLERANCE = 4;
  const map = /* @__PURE__ */ new Map();
  for (const item of items) {
    if (!item.str.trim()) continue;
    const y = Math.round(item.transform[5] / Y_TOLERANCE) * Y_TOLERANCE;
    const x = item.transform[4];
    if (!map.has(y)) map.set(y, []);
    map.get(y).push({ x, y, text: item.str });
  }
  return Array.from(map.entries()).sort(([a], [b]) => b - a).map(([y, rowItems]) => {
    const sorted = rowItems.sort((a, b) => a.x - b.x);
    return { y, items: sorted, text: sorted.map((i) => i.text).join(" ") };
  });
}
function assignCells(row, columns, tolerance = 35) {
  const cells = new Array(columns.length).fill("");
  for (const item of row.items) {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < columns.length; i++) {
      const d = Math.abs(item.x - columns[i]);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    cells[best] = cells[best] ? cells[best] + " " + item.text : item.text;
  }
  return cells;
}
function renderTable(tableRows, columns) {
  if (tableRows.length < 2 || columns.length < 2) return null;
  const grid = tableRows.map((row) => assignCells(row, columns));
  const maxCellLen = Math.max(...grid.flatMap((r) => r.map((c) => c.length)));
  if (maxCellLen > 180) return null;
  const blankCol = columns.map((_, i) => grid.every((r) => !r[i].trim()));
  const filtered = grid.map((row) => row.filter((_, i) => !blankCol[i]));
  if (!filtered[0].length || filtered[0].length < 2) return null;
  const safe = filtered.map(
    (row) => row.map((c) => c.replace(/\|/g, "\\|").replace(/\n/g, " ").trim())
  );
  const colWidths = safe[0].map(
    (_, i) => Math.max(3, ...safe.map((r) => (r[i] || "").length))
  );
  const fmt = (row) => "| " + row.map((c, i) => c.padEnd(colWidths[i])).join(" | ") + " |";
  const sep = "| " + colWidths.map((w) => "-".repeat(w)).join(" | ") + " |";
  const [header, ...data] = safe;
  return [fmt(header), sep, ...data.map(fmt)].join("\n");
}
function detectTableRegions(rows) {
  const regions = [];
  const COL_CLUSTER_GAP = 40;
  const COL_MATCH_TOLERANCE = 35;
  const MIN_TABLE_ROWS = 3;
  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    if (row.items.length < 2) {
      i++;
      continue;
    }
    if (row.text.length > 250) {
      i++;
      continue;
    }
    const seedCols = cluster(row.items.map((it) => it.x), COL_CLUSTER_GAP);
    if (seedCols.length < 2) {
      i++;
      continue;
    }
    let columns = [...seedCols];
    let j = i + 1;
    while (j < rows.length) {
      const next = rows[j];
      if (next.items.length < 1) break;
      if (next.text.length > 250) break;
      if (next.items.length === 1 && next.text.length > 80) break;
      const rowXs = next.items.map((it) => it.x);
      const alignedCount = rowXs.filter((x) => nearAny(x, columns, COL_MATCH_TOLERANCE)).length;
      const alignRatio = alignedCount / rowXs.length;
      if (alignRatio < 0.6) break;
      for (const x of rowXs) {
        if (!nearAny(x, columns, COL_MATCH_TOLERANCE)) columns.push(x);
      }
      columns = cluster(columns, COL_CLUSTER_GAP);
      j++;
    }
    const len = j - i;
    if (len >= MIN_TABLE_ROWS) {
      regions.push({ start: i, end: j, columns });
      i = j;
    } else {
      i++;
    }
  }
  return regions;
}
async function pdfToMarkdown(arrayBuffer) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = "";
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const rows = buildRows(
      content.items
    );
    if (!rows.length) continue;
    const tableRegions = detectTableRegions(rows);
    const inTable = /* @__PURE__ */ new Map();
    tableRegions.forEach((region, ri) => {
      for (let k = region.start; k < region.end; k++) inTable.set(k, { regionIdx: ri });
    });
    const pageLines = [];
    let lastRegion = -1;
    for (let ri = 0; ri < rows.length; ri++) {
      const tableInfo = inTable.get(ri);
      if (tableInfo) {
        const region = tableRegions[tableInfo.regionIdx];
        if (tableInfo.regionIdx !== lastRegion) {
          lastRegion = tableInfo.regionIdx;
          const tableRows = rows.slice(region.start, region.end);
          const rendered = renderTable(tableRows, region.columns);
          if (rendered) {
            pageLines.push(rendered);
          } else {
            for (const r of tableRows) pageLines.push(r.text);
          }
        }
      } else {
        pageLines.push(rows[ri].text);
      }
    }
    const pageText = pageLines.join("\n").trim();
    if (pageText) pages.push(pageText);
  }
  return pages.join("\n\n").trim();
}
var PdfConverter = class {
  accepts(file, streamInfo) {
    const ext = (streamInfo.extension || "").toLowerCase();
    const mime = (streamInfo.mimetype || "").toLowerCase();
    if (ACCEPTED_EXTENSIONS6.includes(ext)) return true;
    return ACCEPTED_MIMETYPES6.some((m) => mime.startsWith(m));
  }
  async convert(file, _streamInfo) {
    const arrayBuffer = await file.arrayBuffer();
    const markdown = await pdfToMarkdown(arrayBuffer);
    return { markdown };
  }
};

// src/converters/epub.ts
var ACCEPTED_EXTENSIONS7 = [".epub"];
var ACCEPTED_MIMETYPES7 = ["application/epub+zip"];
async function epubToMarkdown(arrayBuffer, htmlConverter) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(arrayBuffer);
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
  const manifest = /* @__PURE__ */ new Map();
  for (const item of Array.from(opfDoc.querySelectorAll("manifest item"))) {
    const id = item.getAttribute("id") || "";
    const href = item.getAttribute("href") || "";
    manifest.set(id, opfDir + href);
  }
  const spineItems = Array.from(opfDoc.querySelectorAll("spine itemref")).map(
    (ref) => ref.getAttribute("idref") || ""
  );
  const sections = [];
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
var EpubConverter = class {
  constructor() {
    this.htmlConverter = new HtmlConverter();
  }
  accepts(file, streamInfo) {
    const ext = (streamInfo.extension || "").toLowerCase();
    const mime = (streamInfo.mimetype || "").toLowerCase();
    if (ACCEPTED_EXTENSIONS7.includes(ext)) return true;
    return ACCEPTED_MIMETYPES7.some((m) => mime.startsWith(m));
  }
  async convert(file, _streamInfo) {
    const arrayBuffer = await file.arrayBuffer();
    const markdown = await epubToMarkdown(arrayBuffer, this.htmlConverter);
    return { markdown };
  }
};

// src/post-process.ts
function normalizeWhitespace(text) {
  return text.split("\n").map((line) => line.trimEnd()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// src/markitdown.ts
var EXT_TO_MIME = {
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
  ".rst": "text/x-rst"
};
function getStreamInfo(file) {
  const name = file.name || "";
  const extMatch = name.match(/(\.[^.]+)$/);
  const extension = extMatch ? extMatch[1].toLowerCase() : "";
  const mimetype = file.type || EXT_TO_MIME[extension] || "application/octet-stream";
  return { mimetype, extension, filename: name };
}
var MarkItDown = class {
  constructor(options = {}) {
    this.converters = [];
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
  register(converter, priority) {
    this.converters.push({ converter, priority });
    this.converters.sort((a, b) => a.priority - b.priority);
  }
  async convert(file) {
    const streamInfo = getStreamInfo(file);
    let lastError;
    for (const { converter } of this.converters) {
      if (converter.accepts(file, streamInfo)) {
        try {
          const result = await converter.convert(file, streamInfo);
          return { ...result, markdown: normalizeWhitespace(result.markdown) };
        } catch (err) {
          console.warn(`Converter ${converter.constructor.name} failed:`, err);
          lastError = err;
        }
      }
    }
    const detail = lastError instanceof Error ? `: ${lastError.message}` : "";
    throw new Error(`No converter found for file: ${file.name}${detail}`);
  }
  getSupportedExtensions() {
    return Object.keys(EXT_TO_MIME).sort();
  }
};

// src/index.ts
init_llm_client();

exports.CsvConverter = CsvConverter;
exports.DocxConverter = DocxConverter;
exports.EpubConverter = EpubConverter;
exports.HtmlConverter = HtmlConverter;
exports.MarkItDown = MarkItDown;
exports.PRIORITY_GENERIC = PRIORITY_GENERIC;
exports.PRIORITY_SPECIFIC = PRIORITY_SPECIFIC;
exports.PdfConverter = PdfConverter;
exports.PlainTextConverter = PlainTextConverter;
exports.PptxConverter = PptxConverter;
exports.XlsConverter = XlsConverter;
exports.XlsxConverter = XlsxConverter;
exports.captionImage = captionImage;
exports.normalizeWhitespace = normalizeWhitespace;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map