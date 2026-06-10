import { describe, it, expect, vi } from "vitest";
import { MarkItDown } from "../src/markitdown";

function makeFile(content: string, name: string, type = ""): File {
  return new File([content], name, { type });
}

describe("MarkItDown.convert dispatch", () => {
  it("dispatches .txt to PlainTextConverter", async () => {
    const md = new MarkItDown();
    const result = await md.convert(makeFile("hello world", "test.txt", "text/plain"));
    expect(result.markdown).toBe("hello world");
  });

  it("dispatches .csv to CsvConverter", async () => {
    const md = new MarkItDown();
    const result = await md.convert(makeFile("A,B\n1,2", "test.csv", "text/csv"));
    expect(result.markdown).toContain("| A | B |");
    expect(result.markdown).toContain("| --- |");
  });

  it("dispatches .html to HtmlConverter", async () => {
    const md = new MarkItDown();
    const result = await md.convert(makeFile("<h1>Title</h1>", "test.html", "text/html"));
    expect(result.markdown).toBe("# Title");
  });

  it("dispatches .md passthrough via PlainTextConverter", async () => {
    const md = new MarkItDown();
    const content = "# Already Markdown\n\nSome text.";
    const result = await md.convert(makeFile(content, "test.md", "text/markdown"));
    expect(result.markdown).toBe(content);
  });

  it("throws for unsupported extension with no fallback", async () => {
    const md = new MarkItDown();
    await expect(md.convert(makeFile("data", "test.xyz", "application/xyz"))).rejects.toThrow();
  });

  it("applies whitespace normalization to output", async () => {
    const md = new MarkItDown();
    const result = await md.convert(makeFile("line1   \n\n\n\nline2", "test.txt", "text/plain"));
    expect(result.markdown).toBe("line1\n\nline2");
  });

  it("falls back to next converter on failure", async () => {
    const md = new MarkItDown();
    // .txt with no type — PlainTextConverter accepts by extension, should succeed
    const result = await md.convert(makeFile("fallback text", "test.txt"));
    expect(result.markdown).toContain("fallback text");
  });
});

describe("MarkItDown.register custom converter", () => {
  it("can register and use a custom converter", async () => {
    const md = new MarkItDown();
    md.register(
      {
        accepts: (_f, info) => (info.extension || "") === ".custom",
        convert: async () => ({ markdown: "custom output" }),
      },
      0
    );
    const result = await md.convert(makeFile("data", "test.custom"));
    expect(result.markdown).toBe("custom output");
  });
});

describe("MarkItDown with LLM config", () => {
  it("instantiates without LLM config", () => {
    expect(() => new MarkItDown()).not.toThrow();
  });

  it("instantiates with LLM config", () => {
    expect(
      () =>
        new MarkItDown({
          llmConfig: { provider: "anthropic", apiKey: "sk-ant-test", model: "claude-haiku-4-5-20251001" },
        })
    ).not.toThrow();
  });
});
