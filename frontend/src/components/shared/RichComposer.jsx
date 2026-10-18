import React, { useRef, useState } from "react";
import { toast } from "sonner";
import { Send, Bold, Italic, Strikethrough, Smile, List, ListOrdered, Link2, Paperclip, X, Image as ImageIcon, Video, File as FileIcon, Download } from "lucide-react";
import { compressImage } from "@/lib/imageCompress";

const EMOJI_GROUPS = {
  Visages: ["😀","😁","😂","🤣","😊","😍","😘","😎","🤔","🙄","😅","😏","🥰","😇","🙂","😉","😢","😭","😡","🤯","😱","😴","🤤","😷"],
  Gestes: ["👍","👎","👏","🙏","💪","🤝","✋","👌","✊","🫶","🤌","👉","👈","👆","👇"],
  Cœurs: ["❤️","🧡","💛","💚","💙","💜","🤍","🖤","💔","💕","💞","💓","💗","💖","💘","💝"],
  Mode: ["👗","👚","👕","👖","👠","👡","👢","👜","👛","💄","💍","👒","🧢","🧣","🧥","🕶️"],
  Objets: ["🎁","🎉","🎊","🛍️","💰","💵","💳","📦","📱","📸","⭐","✨","🔥","💯","✅","❌","⏰","📅","🎯","💡","📍","🛵","🏠"],
};
const MAX_FILE = 5 * 1024 * 1024;

export function EmojiPicker({ onPick, onClose }) {
  const [tab, setTab] = useState("Visages");
  return (
    <div className="absolute bottom-full mb-2 -left-24 sm:left-0 bg-white dark:bg-[#1a1a1a] border border-[#ececec] dark:border-[#2a2a2a] rounded-xl shadow-xl p-2 w-72 max-w-[calc(100vw-2rem)] z-30" onClick={e => e.stopPropagation()} data-testid="emoji-picker">
      <div className="flex gap-1 mb-2 border-b border-[#f0f0f0] dark:border-[#2a2a2a] pb-2 overflow-x-auto">
        {Object.keys(EMOJI_GROUPS).map(g => <button key={g} type="button" onClick={() => setTab(g)} className={`px-2 py-1 text-[11px] rounded whitespace-nowrap ${tab === g ? "bg-[#fff5f5] text-[#b02a2a]" : ""}`} data-testid={`emoji-tab-${g}`}>{g}</button>)}
      </div>
      <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
        {EMOJI_GROUPS[tab].map(e => <button key={e} type="button" onClick={() => onPick(e)} className="text-xl hover:bg-[#fff5f5] rounded p-1" data-testid={`emoji-${e}`}>{e}</button>)}
      </div>
      <button type="button" onClick={onClose} className="w-full text-[10px] text-[#666] mt-2">Fermer</button>
    </div>
  );
}

const inline = (s) => s
  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
  .replace(/\*(.+?)\*/g, "<em>$1</em>")
  .replace(/~~(.+?)~~/g, "<s>$1</s>")
  .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)"'<>]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="underline">$1</a>')
  .replace(/(^|\s)(https?:\/\/[^\s<"'>&]+)/g, '$1<a href="$2" target="_blank" rel="noreferrer" class="underline">$2</a>');

export function renderMarkdown(text = "") {
  const esc = String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const out = []; let list = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  esc.split("\n").forEach(line => {
    const ul = line.match(/^\s*[-•]\s+(.*)$/), ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const kind = ul ? "ul" : ol ? "ol" : null;
    if (kind) {
      if (list !== kind) { close(); out.push(kind === "ul" ? '<ul class="list-disc pl-5 my-1">' : '<ol class="list-decimal pl-5 my-1">'); list = kind; }
      out.push(`<li>${inline((ul || ol)[1])}</li>`);
    } else { close(); out.push(inline(line) + "<br/>"); }
  });
  close();
  return out.join("").replace(/(<br\/>)+$/, "");
}

export const plainPreview = (t = "") => String(t).replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*~]/g, "");

export function RichText({ text, className = "" }) {
  if (!text) return null;
  return <div className={`break-words ${className}`} dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}/>;
}

export function AttachmentsView({ items = [], onOpen, light = false }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-1" data-testid="msg-attachments">
      {items.map((a, i) => {
        if (a.type === "image") return <img key={i} src={a.url} alt="Photo" onClick={() => onOpen?.(a.url)} className="w-36 h-28 object-cover rounded-lg cursor-zoom-in hover:opacity-90 transition-opacity" data-testid="thread-photo"/>;
        if (a.type === "video") return <video key={i} src={a.url} controls className="rounded-lg max-h-48 max-w-full" data-testid="thread-video"/>;
        if (a.type === "audio") return <audio key={i} src={a.url} controls className="max-w-full"/>;
        return <a key={i} href={a.url} download={a.name} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 text-xs underline ${light ? "text-white" : "text-[#5867fd]"}`} data-testid="thread-file"><FileIcon size={12}/>{a.name || "fichier"}<Download size={11}/></a>;
      })}
    </div>
  );
}

const readFile = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });

export async function fileToAttachment(file) {
  if (file.type.startsWith("image/")) return { type: "image", url: await compressImage(file, 1600, 0.85), name: file.name, mime: "image/jpeg", size: file.size };
  if (file.size > MAX_FILE) throw new Error("5 Mo maximum par fichier");
  const type = file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "file";
  return { type, url: await readFile(file), name: file.name, mime: file.type || "application/octet-stream", size: file.size };
}

function AttachmentChips({ items, onRemove, testid }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-1.5" data-testid={`${testid}-attachments`}>
      {items.map((a, i) => {
        const Icon = a.type === "image" ? ImageIcon : a.type === "video" ? Video : FileIcon;
        return (
          <div key={i} className="inline-flex items-center gap-2 bg-[#fff5f5] dark:bg-[#2a1818] rounded-lg px-2 py-1 text-xs" data-testid={`${testid}-attachment-${i}`}>
            {a.type === "image" ? <img src={a.url} alt="" className="w-8 h-8 rounded object-cover"/> : <Icon size={14} className="text-[#b02a2a]"/>}
            <span className="max-w-[120px] truncate">{a.name || "fichier"}</span>
            <button type="button" onClick={() => onRemove(i)} className="text-[#c62828]" title="Retirer" data-testid={`${testid}-attachment-remove-${i}`}><X size={12}/></button>
          </div>
        );
      })}
    </div>
  );
}

// One editor everywhere: bold, italic, strike, lists, links, emojis, attachments (images, videos, files)
export function RichComposer({ value, onChange, onSend, attachments = [], onAttachments, sending, canSend, placeholder = "Votre message…", testid = "composer", rows = 1, maxFiles = 5 }) {
  const ref = useRef(null);
  const fileRef = useRef(null);
  const [emoji, setEmoji] = useState(false);
  const editorOnly = !onSend;
  const replaceSel = (fn) => {
    const el = ref.current;
    const s = el?.selectionStart ?? value.length, e = el?.selectionEnd ?? value.length;
    const [ins, selStart, selLen] = fn(value.slice(s, e));
    onChange(value.slice(0, s) + ins + value.slice(e));
    setTimeout(() => { el?.focus(); el?.setSelectionRange(s + selStart, s + selStart + selLen); }, 0);
  };
  const wrap = (mark) => replaceSel(sel => { const t = sel || "texte"; return [mark + t + mark, mark.length, t.length]; });
  const insert = (txt) => replaceSel(() => [txt, txt.length, 0]);
  const listify = (ordered) => replaceSel(sel => {
    const lines = (sel || "élément").split("\n");
    const pre = value && !value.endsWith("\n") && !sel ? "\n" : "";
    const t = pre + lines.map((l, i) => `${ordered ? `${i + 1}.` : "-"} ${l}`).join("\n");
    return [t, t.length, 0];
  });
  const link = () => {
    const url = window.prompt("Adresse du lien (https://…)");
    if (!url) return;
    const href = /^https?:\/\//.test(url) ? url : `https://${url}`;
    replaceSel(sel => { const t = sel || "lien"; return [`[${t}](${href})`, 1, t.length]; });
  };
  const pick = async (e) => {
    const files = Array.from(e.target.files || []); e.target.value = "";
    const room = maxFiles - attachments.length;
    if (files.length > room) toast.error(`${maxFiles} pièces jointes maximum`);
    const added = [];
    for (const f of files.slice(0, Math.max(0, room))) {
      try { added.push(await fileToAttachment(f)); } catch (err) { toast.error(`${f.name} : ${err.message}`); }
    }
    if (added.length) onAttachments([...attachments, ...added]);
  };
  const doSend = () => { setEmoji(false); onSend?.(); };
  const tb = "p-1.5 rounded hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a2a] text-[#666]";
  return (
    <div data-testid={testid}>
      <div className="flex items-center gap-0.5 mb-1 flex-wrap">
        <button type="button" onClick={() => wrap("**")} className={tb} title="Gras" data-testid={`${testid}-bold`}><Bold size={14}/></button>
        <button type="button" onClick={() => wrap("*")} className={tb} title="Italique" data-testid={`${testid}-italic`}><Italic size={14}/></button>
        <button type="button" onClick={() => wrap("~~")} className={tb} title="Barré" data-testid={`${testid}-strike`}><Strikethrough size={14}/></button>
        <button type="button" onClick={() => listify(false)} className={tb} title="Liste à puces" data-testid={`${testid}-list`}><List size={14}/></button>
        <button type="button" onClick={() => listify(true)} className={tb} title="Liste numérotée" data-testid={`${testid}-olist`}><ListOrdered size={14}/></button>
        <button type="button" onClick={link} className={tb} title="Lien" data-testid={`${testid}-link`}><Link2 size={14}/></button>
        <div className="relative">
          <button type="button" onClick={() => setEmoji(!emoji)} className={`${tb} ${emoji ? "text-[#b02a2a]" : ""}`} title="Emoji" data-testid={`${testid}-emoji`}><Smile size={14}/></button>
          {emoji && <EmojiPicker onPick={e => { insert(e); setEmoji(false); }} onClose={() => setEmoji(false)}/>}
        </div>
        {onAttachments && <>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={sending} className={tb} title="Joindre une photo, une vidéo ou un fichier" data-testid={`${testid}-attach`}><Paperclip size={14}/></button>
          <input ref={fileRef} type="file" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" className="hidden" onChange={pick} data-testid={`${testid}-file-input`}/>
        </>}
      </div>
      {onAttachments && <AttachmentChips items={attachments} onRemove={i => onAttachments(attachments.filter((_, k) => k !== i))} testid={testid}/>}
      <div className="flex gap-2 items-end">
        <textarea ref={ref} rows={rows} className={`dina-input flex-1 ${editorOnly ? "" : "resize-none !min-h-[40px] max-h-32"}`} placeholder={placeholder} value={value}
          onChange={e => onChange(e.target.value)} onKeyDown={e => { if (!editorOnly && e.key === "Enter" && !e.shiftKey && !window.matchMedia("(pointer: coarse)").matches) { e.preventDefault(); doSend(); } }} data-testid={`${testid}-input`}/>
        {!editorOnly && <button type="button" onClick={doSend} disabled={sending || !canSend} className="dina-btn-primary !min-h-[40px]" data-testid={`${testid}-send`}><Send size={13}/><span className="hidden sm:inline">{sending ? "…" : "Envoyer"}</span></button>}
      </div>
    </div>
  );
}
