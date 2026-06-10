// Mirrors Python markitdown post-processing for token-efficient LLM output.
// - Strips trailing whitespace per line
// - Collapses 3+ consecutive blank lines → 2 (one paragraph break)
// - Strips leading/trailing whitespace from entire document
export function normalizeWhitespace(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
