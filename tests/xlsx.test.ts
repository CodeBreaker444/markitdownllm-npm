import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { XlsxConverter } from "../src/converters/xlsx";

const converter = new XlsxConverter();
const xlsxInfo = { extension: ".xlsx", mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };

function makeXlsxFile(sheets: Record<string, unknown[][]>): File {
  const wb = XLSX.utils.book_new();
  for (const [name, data] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new File([buf], "test.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("XlsxConverter.accepts", () => {
  it("accepts .xlsx by extension", () => {
    expect(converter.accepts(new File([], "f.xlsx"), xlsxInfo)).toBe(true);
  });

  it("rejects .csv", () => {
    expect(converter.accepts(new File([], "f.csv"), { extension: ".csv", mimetype: "text/csv" })).toBe(false);
  });
});

describe("XlsxConverter.convert", () => {
  it("produces GFM table with separator row", async () => {
    const file = makeXlsxFile({
      Sheet1: [["Name", "Score"], ["Alice", 95], ["Bob", 87]],
    });
    const result = await converter.convert(file, xlsxInfo);
    const lines = result.markdown.split("\n");
    const headerIdx = lines.findIndex((l) => l.includes("Name") && l.includes("Score"));
    expect(headerIdx).toBeGreaterThanOrEqual(0);
    expect(lines[headerIdx + 1]).toMatch(/^\| -+/);
    expect(lines[headerIdx + 2]).toContain("Alice");
    expect(lines[headerIdx + 2]).toContain("95");
  });

  it("includes sheet name as h2 heading", async () => {
    const file = makeXlsxFile({ Inventory: [["Item", "Qty"], ["Widget", 10]] });
    const result = await converter.convert(file, xlsxInfo);
    expect(result.markdown).toContain("## Inventory");
  });

  it("handles multiple sheets", async () => {
    const file = makeXlsxFile({
      "Sheet A": [["X", "Y"], [1, 2]],
      "Sheet B": [["P", "Q"], [3, 4]],
    });
    const result = await converter.convert(file, xlsxInfo);
    expect(result.markdown).toContain("## Sheet A");
    expect(result.markdown).toContain("## Sheet B");
  });

  it("escapes pipe characters in cells", async () => {
    const file = makeXlsxFile({ S: [["Header", "Notes"], ["A|B", "test"]] });
    const result = await converter.convert(file, xlsxInfo);
    expect(result.markdown).toContain("A\\|B");
  });

  it("handles numeric and boolean cell values", async () => {
    const file = makeXlsxFile({ S: [["Num", "Bool"], [42, true]] });
    const result = await converter.convert(file, xlsxInfo);
    expect(result.markdown).toContain("42");
    expect(result.markdown.toLowerCase()).toContain("true");
  });
});
