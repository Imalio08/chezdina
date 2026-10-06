import React, { useState } from "react";
import { Plus, Check } from "lucide-react";

/** Select / combobox with inline "+ Ajouter …" that appends and selects the new value immediately. */
export default function CreateOnFlySelect({ label, value, onChange, options = [], onCreate, placeholder = "Choisir…", createLabel, testid }) {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");

  const confirm = async () => {
    const v = draft.trim();
    if (!v) return;
    if (onCreate) await onCreate(v);        // caller should push to options and return/update
    onChange?.(v);
    setDraft(""); setCreating(false);
  };

  return (
    <div>
      {label && <label className="text-xs uppercase text-[#666] font-semibold">{label}</label>}
      {!creating ? (
        <select className="dina-input mt-1" value={value||""} onChange={e => e.target.value === "__add__" ? setCreating(true) : onChange?.(e.target.value)} data-testid={testid}>
          <option value="">{placeholder}</option>
          {options.map(o => <option key={o.value||o} value={o.value||o}>{o.label||o}</option>)}
          <option value="__add__" style={{color:"#b02a2a",fontWeight:600}}>+ {createLabel || `Ajouter ${label?label.toLowerCase():"une valeur"}`}</option>
        </select>
      ) : (
        <div className="flex gap-1 mt-1">
          <input autoFocus className="dina-input flex-1" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")confirm();if(e.key==="Escape")setCreating(false);}} placeholder={createLabel || `Nouvelle valeur`} data-testid={`${testid}-new-input`}/>
          <button onClick={confirm} className="dina-btn-primary !min-h-[40px] !px-3" data-testid={`${testid}-new-confirm`}><Check size={14}/></button>
          <button onClick={()=>{setCreating(false); setDraft("");}} className="dina-btn-secondary !min-h-[40px] !px-3">×</button>
        </div>
      )}
    </div>
  );
}
