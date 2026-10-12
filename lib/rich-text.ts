export type RichRun = { text: string; bold?: boolean; italic?: boolean; underline?: boolean };
export type RichBlock = { type: "paragraph" | "bullet" | "number"; runs: RichRun[] };
export type RichDocument = { v: 1; blocks: RichBlock[] };

export function parseRichText(value: string): RichDocument {
  try {
    const parsed: unknown = JSON.parse(value);
    if (isRichDocument(parsed)) return parsed;
  } catch { /* Existing plain text remains readable. */ }
  return { v: 1, blocks: value ? value.split(/\r?\n/).map(line => ({ type: "paragraph", runs: [{ text: line }] })) : [] };
}

export const richPlainText = (value: string) => parseRichText(value).blocks.map(block => block.runs.map(run => run.text).join("")).join(" ");

export function isRichDocument(value: unknown): value is RichDocument {
  if (!value || typeof value !== "object") return false;
  const doc = value as Record<string, unknown>;
  if (doc.v !== 1 || !Array.isArray(doc.blocks) || doc.blocks.length > 80) return false;
  let length = 0;
  for (const block of doc.blocks) {
    if (!block || typeof block !== "object" || !["paragraph", "bullet", "number"].includes(block.type) || !Array.isArray(block.runs) || block.runs.length > 100) return false;
    for (const run of block.runs) {
      if (!run || typeof run !== "object" || typeof run.text !== "string") return false;
      if (["bold", "italic", "underline"].some(key => run[key] !== undefined && typeof run[key] !== "boolean")) return false;
      length += run.text.length;
      if (length > 3000) return false;
    }
  }
  return true;
}
