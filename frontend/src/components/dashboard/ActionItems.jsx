import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { AlertTriangle, Receipt, Package, Truck, Clock, ShoppingCart, Star, Zap } from "lucide-react";

const waitFmt = (m) => m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m/60)} h` : `${Math.floor(m/1440)} j`;

const CARDS = [
  { key:"nouvelles", label:"À confirmer", icon:Receipt, color:"#e4991e", desc:"Commandes à confirmer" },
  { key:"preparation", label:"À préparer", icon:Package, color:"#5867fd", desc:"Confirmées, à scanner" },
  { key:"pretes_non_affectees", label:"À affecter", icon:Zap, color:"#b02a2a", desc:"Prêtes sans livreur" },
  { key:"en_livraison", label:"En livraison", icon:Truck, color:"#1f8a4c", desc:"Courses actives" },
  { key:"rupture", label:"Ruptures", icon:AlertTriangle, color:"#c62828", desc:"Variantes à 0" },
  { key:"stock_bas", label:"Stock bas", icon:AlertTriangle, color:"#e4991e", desc:"Moins de 5" },
  { key:"paniers_abandonnes", label:"Paniers abandonnés", icon:ShoppingCart, color:"#5867fd", desc:"À relancer" },
  { key:"avis_a_valider", label:"Avis à valider", icon:Star, color:"#b02a2a", desc:"Modération" },
];

export default function ActionItems() {
  const [data, setData] = useState(null);
  const nav = useNavigate();
  useEffect(() => {
    const load = () => api.get("/dashboard/action-items").then(r=>setData(r.data)).catch(()=>{});
    load(); const t = setInterval(load, 60000); return () => clearInterval(t);
  }, []);
  if (!data) return null;
  return (
    <div className="space-y-2">
      <div className="font-semibold text-sm flex items-center gap-2"><Clock size={14} className="text-[#b02a2a]"/>À traiter maintenant</div>
      <div className="text-xs text-[#666]">Actions urgentes qui demandent une intervention · mis à jour chaque minute</div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {CARDS.map(c => {
          const d = data[c.key] || { count: 0 };
          const empty = !d.count;
          return (
            <button key={c.key} onClick={()=>d.link && nav(d.link)} disabled={empty}
              className={`dina-card-white p-3 text-left transition hover:border-[#b02a2a] hover:shadow-sm disabled:opacity-60 disabled:cursor-default`}
              data-testid={`action-${c.key}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="w-7 h-7 rounded-lg grid place-items-center shrink-0" style={{background:`${c.color}1a`,color:c.color}}><c.icon size={13}/></div>
                {d.wait_min > 10 && <span className="text-[9px] text-[#c62828] font-bold flex items-center gap-0.5" title="Attente de la plus ancienne" data-testid={`action-${c.key}-wait`}><Clock size={9}/>{waitFmt(d.wait_min)}</span>}
              </div>
              <div className="font-serif text-2xl tabular leading-none" style={{color: empty?"#999":c.color}}>{d.count}</div>
              <div className="text-[10px] uppercase tracking-wider text-[#666] font-semibold mt-1 truncate">{c.label}</div>
              <div className="text-[10px] text-[#999] mt-0.5 truncate">{c.desc}</div>
              {d.by_rider?.length > 0 && <div className="text-[10px] text-[#666] mt-1 truncate">{d.by_rider.map(r=>`${r.name.split(" ")[0]}:${r.count}`).join(" · ")}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
