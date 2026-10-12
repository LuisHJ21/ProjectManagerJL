"use client";

import { useEffect, useRef } from "react";
import { Bold, Italic, List, ListOrdered, Underline } from "lucide-react";
import { parseRichText, type RichBlock, type RichRun } from "../lib/rich-text";

const escapeHtml = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const runHtml = (run: RichRun) => {
  let html = escapeHtml(run.text);
  if (run.bold) html = `<strong>${html}</strong>`;
  if (run.italic) html = `<em>${html}</em>`;
  if (run.underline) html = `<u>${html}</u>`;
  return html;
};
const blockHtml = (block: RichBlock) => {
  const html = block.runs.map(runHtml).join("") || "<br>";
  return block.type === "bullet" ? `<ul><li>${html}</li></ul>` : block.type === "number" ? `<ol><li>${html}</li></ol>` : `<p>${html}</p>`;
};

function readRuns(node: Node, marks: Pick<RichRun, "bold" | "italic" | "underline"> = {}): RichRun[] {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ? [{ text: node.textContent, ...marks }] : [];
  if (!(node instanceof HTMLElement)) return [];
  if (node.tagName === "BR") return [{ text: "\n", ...marks }];
  const next = { ...marks };
  if (["B", "STRONG"].includes(node.tagName)) next.bold = true;
  if (["I", "EM"].includes(node.tagName)) next.italic = true;
  if (node.tagName === "U") next.underline = true;
  return Array.from(node.childNodes).flatMap(child => readRuns(child, next));
}

function readBlocks(root: HTMLElement): RichBlock[] {
  const blocks: RichBlock[] = [];
  for (const child of Array.from(root.childNodes)) {
    if (child instanceof HTMLElement && ["UL", "OL"].includes(child.tagName)) {
      for (const li of Array.from(child.children)) blocks.push({ type: child.tagName === "UL" ? "bullet" : "number", runs: readRuns(li) });
    } else if (child instanceof HTMLElement && ["DIV", "P"].includes(child.tagName)) {
      blocks.push({ type: "paragraph", runs: readRuns(child) });
    } else {
      const runs = readRuns(child);
      if (runs.length) blocks.push({ type: "paragraph", runs });
    }
  }
  return blocks;
}

export function RichEditor({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.innerHTML = parseRichText(value).blocks.map(blockHtml).join(""); }, []);
  const sync = () => { if (ref.current) onChange(JSON.stringify({ v: 1, blocks: readBlocks(ref.current) })); };
  const command = (name: string) => { document.execCommand(name); sync(); ref.current?.focus(); };
  return <div className="block">
    <span className="mb-1.5 block text-xs font-semibold text-[#3f617b]">{label}</span>
    <div className="overflow-hidden rounded-xl border border-[#dce8f1] focus-within:border-[#4c9ac9] focus-within:ring-2 focus-within:ring-[#d8edfa]">
      <div className="flex gap-1 border-b border-[#e7eff5] bg-[#f6fafe] p-1.5" aria-label={`Formato de ${label}`}>
        {([["bold", Bold, "Negrita"], ["italic", Italic, "Cursiva"], ["underline", Underline, "Subrayado"], ["insertUnorderedList", List, "Lista con viñetas"], ["insertOrderedList", ListOrdered, "Lista numerada"]] as const).map(([name, Icon, title]) => <button key={name} type="button" title={title} aria-label={title} onMouseDown={event => event.preventDefault()} onClick={() => command(name)} className="rounded-md p-1.5 text-[#426d8c] hover:bg-[#dceefa]"><Icon size={15}/></button>)}
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning role="textbox" aria-label={label} aria-multiline="true" onInput={sync} onPaste={event => { event.preventDefault(); document.execCommand("insertText", false, event.clipboardData.getData("text/plain")); sync(); }} className="rich-content min-h-24 px-3 py-2 text-sm text-[#214968] outline-none" />
    </div>
  </div>;
}

export function RichDisplay({ value }: { value: string }) {
  const blocks = parseRichText(value).blocks;
  if (!blocks.length) return <span className="text-[#97aebf]">Sin registrar</span>;
  const content = (runs: RichRun[]) => runs.map((run, index) => {
    let node: React.ReactNode = run.text;
    if (run.bold) node = <strong>{node}</strong>;
    if (run.italic) node = <em>{node}</em>;
    if (run.underline) node = <u>{node}</u>;
    return <span key={index}>{node}</span>;
  });
  return <div className="rich-content space-y-1">{blocks.map((block, index) => block.type === "bullet" ? <ul key={index}><li>{content(block.runs)}</li></ul> : block.type === "number" ? <ol key={index}><li>{content(block.runs)}</li></ol> : <p key={index}>{content(block.runs)}</p>)}</div>;
}
