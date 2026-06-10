import { describe, it, expect } from "vitest";
import { PlainTextConverter } from "../src/converters/plain-text";

const converter = new PlainTextConverter();

function makeFile(content: string, name = "test.txt"): File {
  return new File([content], name, { type: "text/plain" });
}

describe("PlainTextConverter.accepts", () => {
  it("accepts .txt", () => expect(converter.accepts(makeFile(""), { extension: ".txt", mimetype: "text/plain" })).toBe(true));
  it("accepts .md", () => expect(converter.accepts(makeFile("", "f.md"), { extension: ".md", mimetype: "text/markdown" })).toBe(true));
  it("accepts .rst", () => expect(converter.accepts(makeFile("", "f.rst"), { extension: ".rst", mimetype: "text/x-rst" })).toBe(true));
  it("rejects .pdf", () => expect(converter.accepts(makeFile(""), { extension: ".pdf", mimetype: "application/pdf" })).toBe(false));
});

describe("PlainTextConverter.convert", () => {
  it("returns content unchanged", async () => {
    const text = "# Hello\n\nSome text.\n\n- item 1\n- item 2";
    const result = await converter.convert(makeFile(text), { extension: ".txt", mimetype: "text/plain" });
    expect(result.markdown).toBe(text);
  });

  it("handles empty file", async () => {
    const result = await converter.convert(makeFile(""), { extension: ".txt", mimetype: "text/plain" });
    expect(result.markdown).toBe("");
  });

  it("handles unicode content", async () => {
    const text = "こんにちは 🌍 Привет";
    const result = await converter.convert(makeFile(text), { extension: ".txt", mimetype: "text/plain" });
    expect(result.markdown).toBe(text);
  });
});
