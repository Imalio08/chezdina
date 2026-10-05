import React, { useState } from "react";
import api from "@/lib/api";
import { Sparkles, Send, Mic } from "lucide-react";

const CHIPS = ["Quel est mon produit le plus rentable ce mois ?","Quelles pointures recommander pour la rentrée ?","Pourquoi la marge a baissé cette semaine ?","Clients inactifs depuis 60 jours ?","Quel livreur a le plus de retards ?"];

export default function AskDina() {
  const [msgs, setMsgs] = useState([{role:"bot",text:"Bonjour, je suis Dina Assist. Posez-moi une question sur votre activité."}]);
  const [q, setQ] = useState(""); const [loading, setLoading] = useState(false);
  const ask = async (text) => {
    const t = text ?? q; if (!t.trim()) return;
    setMsgs(m=>[...m,{role:"user",text:t}]); setQ(""); setLoading(true);
    try { const { data } = await api.post("/ai/ask",{question:t}); setMsgs(m=>[...m,{role:"bot",text:data.answer}]); }
    catch { setMsgs(m=>[...m,{role:"bot",text:"Impossible de répondre pour le moment."}]); }
    setLoading(false);
  };
  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div><h1 className="font-serif text-3xl flex items-center gap-2"><Sparkles className="text-[#f4b12c]"/>Ask Dina</h1><p className="text-sm text-[#666]">Posez une question sur votre activité en français</p></div>
      <div className="dina-card-white p-4 min-h-[380px] max-h-[55vh] overflow-y-auto scrollbar-thin space-y-3">
        {msgs.map((m,i)=><div key={i} className={`flex ${m.role==="user"?"justify-end":""}`}><div className={`max-w-[75%] p-3 rounded-xl text-sm whitespace-pre-wrap ${m.role==="user"?"bg-[#1c1c1c] text-white":"bg-[#f5f5f5]"}`} data-testid={`ai-msg-${i}`}>{m.text}</div></div>)}
        {loading && <div className="text-xs text-[#666]">Dina réfléchit…</div>}
      </div>
      <div className="flex gap-2 flex-wrap">{CHIPS.map(c=><button key={c} onClick={()=>ask(c)} className="dina-chip" data-testid={`ai-chip-${c.slice(0,10)}`}>{c}</button>)}</div>
      <div className="flex gap-2">
        <input className="dina-input" placeholder="Posez une question…" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&ask()} data-testid="ai-input"/>
        <button className="dina-btn-secondary !min-h-[44px]" data-testid="ai-mic"><Mic size={16}/></button>
        <button onClick={()=>ask()} className="dina-btn-primary !min-h-[44px]" data-testid="ai-send"><Send size={16}/></button>
      </div>
    </div>
  );
}
