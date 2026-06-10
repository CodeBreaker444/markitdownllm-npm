import { describe, it, expect } from "vitest";
import { normalizeWhitespace } from "../src/post-process";

describe("normalizeWhitespace", () => {
  it("trims leading and trailing whitespace", () => {
    expect(normalizeWhitespace("  hello  ")).toBe("hello");
  });

  it("strips trailing spaces from each line", () => {
    expect(normalizeWhitespace("line1   \nline2  ")).toBe("line1\nline2");
  });

  it("collapses 3+ blank lines to 2", () => {
    const input = "a\n\n\n\n\nb";
    expect(normalizeWhitespace(input)).toBe("a\n\nb");
  });

  it("preserves single blank lines", () => {
    expect(normalizeWhitespace("a\n\nb")).toBe("a\n\nb");
  });

  it("preserves two consecutive blank lines", () => {
    expect(normalizeWhitespace("a\n\n\nb")).toBe("a\n\nb");
  });

  it("handles empty string", () => {
    expect(normalizeWhitespace("")).toBe("");
  });

  it("handles only whitespace", () => {
    expect(normalizeWhitespace("   \n   \n   ")).toBe("");
  });

  it("preserves internal content unchanged", () => {
    const md = "# Heading\n\nParagraph with **bold** and `code`.\n\n- item 1\n- item 2";
    expect(normalizeWhitespace(md)).toBe(md);
  });
});
