import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { dateTimeFmt } from "@/lib/format";
import { toast } from "sonner";

export default function Team() {
  const [t, setT] = useState([]); const [att, setAtt] = useState([]); const [code, setCode] = useState("");
  const load = ()=>Promise.all([api.get("/team"),api.get("/attendance")]).then(([a,b])=>{setT(a.data);setAtt(b.data);});
  useEffect(load,[]);
  const punch = async ()=>{try{const r=await api.post("/attendance/punch",{code});toast.success(`Pointé: ${r.data.user}`);setCode("");load();}catch{toast.error("Code inconnu");}};
  const today = new Date().toISOString().slice(0,10);
  const present = new Set(att.filter(x=>x.at.slice(0,10)===today).map(x=>x.user_id));
  return (
    <div className="space-y-5">
      <div><h1 className="font-serif text-3xl">Équipe</h1><p className="text-sm text-[#666]">Pointage, présences, planning, performance</p></div>
      <div className="dina-card-white p-5">
        <div className="font-semibold mb-2">Borne de pointage</div>
        <div className="flex gap-2 items-center">
          <input className="dina-input max-w-xs text-center text-2xl tracking-widest" inputMode="numeric" maxLength={4} placeholder="Code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))} data-testid="attendance-code"/>
          <button onClick={punch} className="dina-btn-primary !min-h-[48px]" data-testid="attendance-punch">Pointer</button>
          <div className="text-xs text-[#666] ml-2">Codes démo: 2222, 3333, 4444, 5555…</div>
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Équipe ({t.length})</div>
          <table className="dina-table"><thead><tr><th>Nom</th><th>Rôle</th><th>Téléphone</th><th>Statut</th></tr></thead>
          <tbody>{t.map(u=><tr key={u.id} data-testid={`team-row-${u.email}`}><td className="font-medium">{u.name}</td><td className="capitalize">{u.role}</td><td className="text-[#666]">{u.phone}</td><td>{present.has(u.id)?<span className="dina-chip" style={{color:"#1f8a4c"}}><span className="status-dot" style={{background:"#1f8a4c"}}/>Présent</span>:<span className="dina-chip" style={{color:"#666"}}>—</span>}</td></tr>)}</tbody></table>
        </div>
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Pointages récents</div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
            {att.slice(0,30).map(x=><div key={x.id} className="flex justify-between text-sm py-1.5 border-b border-[#f0f0f0]"><div><div className="font-medium">{x.user_name}</div><div className="text-xs text-[#666] capitalize">{x.role}</div></div><div className="text-xs text-[#666] text-right"><div>{dateTimeFmt(x.at)}</div>{x.late && <div className="text-[#c62828]">Retard</div>}</div></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
