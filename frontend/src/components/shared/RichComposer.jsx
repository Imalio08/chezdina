import React, { useRef, useState } from "react";
import { Send, Bold, Italic, Strikethrough, Smile } from "lucide-react";
import { PhotoButton } from "@/components/shared/OrderThread";

const EMOJI_GROUPS = {
  Visages: ["😀","😁","😂","🤣","😊","😍","😘","😎","🤔","🙄","😅","😏","🥰","😇","🙂","😉","😢","😭","😡","🤯","😱","😴","🤤","😷"],
  Gestes: ["👍","👎","👏","🙏","💪","🤝","✋","👌","✊","🫶","🤌","👉","👈","👆","👇"],
  Cœurs: ["❤️","🧡","💛","💚","💙","💜","🤍","🖤","💔","💕","💞","💓","💗","💖","💘","💝"],
  Mode: ["👗","👚","👕","👖","👠","👡","👢","👜","👛","💄","💍","👒","🧢","🧣","🧥","🕶️"],
  Objets: ["🎁","🎉","🎊","🛍️","💰","💵","💳","📦","📱","📸","⭐","✨","🔥","💯","✅","❌","⏰","📅","🎯","💡","📍","🛵","🏠"],
};

export function EmojiPicker({ onPick, onClose }) {
  const [tab, setTab] = useState("Visages");
  return (
    <div className="absolute bottom-full mb-2 left-0 bg-white dark:bg-[#1a1a1a] border border-[#ececec] dark:border-[#2a2a2a] rounded-xl shadow-xl p-2 w-72 max-w-[85vw] z-30" onClick={e => e.stopPropagation()} data-testid="emoji-picker">
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

export function renderMarkdown(text = "") {
  return String(text)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/~~(.+?)~~/g, "<s>$1</s>")
    .replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noreferrer" class="underline">$2</a>')
    .replace(/\n/g, "<br/>");
}

export function RichText({ text, className = "" }) {
  if (!text) return null;
  return <div className={`break-words ${className}`} dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}/>;
}

// Shared composer (console order threads, client, rider): emojis, bold/italic/strike, photo, Enter to send
export function RichComposer({ value, onChange, onSend, onPhoto, sending, canSend, placeholder = "Votre message…", testid = "composer" }) {
  const ref = useRef(null);
  const [emoji, setEmoji] = useState(false);
  const wrap = (before, after = before) => {
    const el = ref.current;
    const s = el?.selectionStart ?? value.length, e = el?.selectionEnd ?? value.length;
    const sel = value.slice(s, e) || (after ? "texte" : "");
    onChange(value.slice(0, s) + before + sel + after + value.slice(e));
    setTimeout(() => { el?.focus(); el?.setSelectionRange(s + before.length, s + before.length + sel.length); }, 0);
  };
  const tb = "p-1.5 rounded hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a2a] text-[#666]";
  return (
    <div data-testid={testid}>
      <div className="flex items-center gap-0.5 mb-1">
        <button type="button" onClick={() => wrap("**")} className={tb} title="Gras" data-testid={`${testid}-bold`}><Bold size={13}/></button>
        <button type="button" onClick={() => wrap("*")} className={tb} title="Italique" data-testid={`${testid}-italic`}><Italic size={13}/></button>
        <button type="button" onClick={() => wrap("~~")} className={tb} title="Barré" data-testid={`${testid}-strike`}><Strikethrough size={13}/></button>
        <div className="relative">
          <button type="button" onClick={() => setEmoji(!emoji)} className={`${tb} ${emoji ? "text-[#b02a2a]" : ""}`} title="Emoji" data-testid={`${testid}-emoji`}><Smile size={13}/></button>
          {emoji && <EmojiPicker onPick={e => wrap(e, "")} onClose={() => setEmoji(false)}/>}
        </div>
      </div>
      <div className="flex gap-2 items-end">
        {onPhoto && <PhotoButton onPick={onPhoto} disabled={sending} testid={`${testid}-photo`}/>}
        <textarea ref={ref} rows={1} className="dina-input flex-1 resize-none !min-h-[40px] max-h-32" placeholder={placeholder} value={value}
          onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }} data-testid={`${testid}-input`}/>
        <button type="button" onClick={onSend} disabled={sending || !canSend} className="dina-btn-primary !min-h-[40px]" data-testid={`${testid}-send`}><Send size={13}/><span className="hidden sm:inline">{sending ? "…" : "Envoyer"}</span></button>
      </div>
    </div>
  );
}
