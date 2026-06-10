import { describe, it, expect } from "vitest";
import { CsvConverter } from "../src/converters/csv";

function makeFile(content: string, name = "test.csv"): File {
  return new File([content], name, { type: "text/csv" });
}

const converter = new CsvConverter();
const info = (ext = ".csv") => ({ extension: ext, mimetype: "text/csv" });

describe("CsvConverter.accepts", () => {
  it("accepts .csv extension", () => {
    expect(converter.accepts(makeFile(""), info(".csv"))).toBe(true);
  });

  it("accepts .tsv extension", () => {
    expect(converter.accepts(makeFile("", "t.tsv"), info(".tsv"))).toBe(true);
  });

  it("rejects .txt", () => {
    expect(converter.accepts(makeFile("", "t.txt"), { extension: ".txt", mimetype: "text/plain" })).toBe(false);
  });
});

describe("CsvConverter.convert", () => {
  it("produces GFM table with separator row", async () => {
    const csv = "Name,Age,City\nAlice,30,NYC\nBob,25,LA";
    const result = await converter.convert(makeFile(csv), info());
    const lines = result.markdown.split("\n");
    expect(lines[0]).toBe("| Name | Age | City |");
    expect(lines[1]).toBe("| --- | --- | --- |");
    expect(lines[2]).toBe("| Alice | 30 | NYC |");
    expect(lines[3]).toBe("| Bob | 25 | LA |");
  });

  it("handles quoted fields with commas", async () => {
    const csv = `Name,Notes\nAlice,"Hello, world"\nBob,Simple`;
    const result = await converter.convert(makeFile(csv), info());
    expect(result.markdown).toContain("Hello, world");
    expect(result.markdown.split("\n")[0]).toBe("| Name | Notes |");
  });

  it("handles quoted fields with embedded newlines", async () => {
    const csv = `A,B\n"line1\nline2",val`;
    const result = await converter.convert(makeFile(csv), info());
    expect(result.markdown).toContain("line1");
  });

  it("handles escaped quotes (doubled)", async () => {
    const csv = `A,B\n"say ""hi""",val`;
    const result = await converter.convert(makeFile(csv), info());
    expect(result.markdown).toContain('say "hi"');
  });

  it("pads short rows to header width", async () => {
    const csv = "A,B,C\n1,2";
    const result = await converter.convert(makeFile(csv), info());
    expect(result.markdown).toContain("| 1 | 2 |  |");
  });

  it("skips empty input", async () => {
    const result = await converter.convert(makeFile(""), info());
    expect(result.markdown).toBe("");
  });

  it("uses tab delimiter for .tsv", async () => {
    const tsv = "A\tB\tC\n1\t2\t3";
    const result = await converter.convert(makeFile(tsv, "t.tsv"), info(".tsv"));
    expect(result.markdown.split("\n")[0]).toBe("| A | B | C |");
  });
});
