import { describe, it, expect } from "vitest";
import { HtmlConverter } from "../src/converters/html";

const converter = new HtmlConverter();
const info = { extension: ".html", mimetype: "text/html" };

function makeFile(content: string): File {
  return new File([content], "test.html", { type: "text/html" });
}

describe("HtmlConverter.accepts", () => {
  it("accepts .html", () => {
    expect(converter.accepts(makeFile(""), info)).toBe(true);
  });

  it("accepts .htm", () => {
    expect(converter.accepts(makeFile(""), { extension: ".htm", mimetype: "text/html" })).toBe(true);
  });

  it("rejects .pdf", () => {
    expect(converter.accepts(makeFile(""), { extension: ".pdf", mimetype: "application/pdf" })).toBe(false);
  });
});

describe("HtmlConverter.convertString", () => {
  it("converts h1 to ATX heading", () => {
    const { markdown } = converter.convertString("<h1>Hello</h1>");
    expect(markdown).toBe("# Hello");
  });

  it("converts h2 to ATX heading", () => {
    const { markdown } = converter.convertString("<h2>Sub</h2>");
    expect(markdown).toBe("## Sub");
  });

  it("converts paragraph to plain text", () => {
    const { markdown } = converter.convertString("<p>Hello world</p>");
    expect(markdown).toBe("Hello world");
  });

  it("converts unordered list to dash list", () => {
    const { markdown } = converter.convertString("<ul><li>A</li><li>B</li></ul>");
    expect(markdown).toContain("-");
    expect(markdown).toContain("A");
    expect(markdown).toContain("B");
  });

  it("converts ordered list", () => {
    const { markdown } = converter.convertString("<ol><li>First</li><li>Second</li></ol>");
    expect(markdown).toContain("1.");
    expect(markdown).toContain("First");
  });

  it("converts links", () => {
    const { markdown } = converter.convertString('<a href="https://example.com">Link</a>');
    expect(markdown).toBe("[Link](https://example.com)");
  });

  it("converts bold and italic", () => {
    const { markdown } = converter.convertString("<strong>bold</strong> and <em>italic</em>");
    expect(markdown).toContain("**bold**");
    expect(markdown).toContain("_italic_");
  });

  it("converts inline code", () => {
    const { markdown } = converter.convertString("<code>console.log()</code>");
    expect(markdown).toContain("`console.log()`");
  });

  it("converts code blocks with fenced style", () => {
    const { markdown } = converter.convertString("<pre><code>const x = 1;</code></pre>");
    expect(markdown).toContain("```");
    expect(markdown).toContain("const x = 1;");
  });

  it("converts HTML table to GFM table", () => {
    const html = `<table>
      <thead><tr><th>Name</th><th>Age</th></tr></thead>
      <tbody><tr><td>Alice</td><td>30</td></tr></tbody>
    </table>`;
    const { markdown } = converter.convertString(html);
    expect(markdown).toContain("Name");
    expect(markdown).toContain("Age");
    expect(markdown).toContain("| --- |");
    expect(markdown).toContain("Alice");
    expect(markdown).toContain("30");
  });

  it("strips script tags", () => {
    const { markdown } = converter.convertString('<p>Hello</p><script>alert(1)</script>');
    expect(markdown).not.toContain("alert");
    expect(markdown).toContain("Hello");
  });

  it("strips style tags", () => {
    const { markdown } = converter.convertString("<p>Text</p><style>body{color:red}</style>");
    expect(markdown).not.toContain("color:red");
  });

  it("prefers main content over body", () => {
    const html = `<body><nav>Nav</nav><main><p>Content</p></main></body>`;
    const { markdown } = converter.convertString(html);
    expect(markdown).toBe("Content");
  });
});
