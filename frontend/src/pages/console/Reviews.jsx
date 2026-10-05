import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Star, Check, X, Trash2 } from "lucide-react";
import { dateFmt } from "@/lib/format";

export default function Reviews() {
  const [tab, setTab] = useState("pending");
  const [rows, setRows] = useState([]);
  const load = async () => { try { const r = await api.get(`/reviews?status=${tab}`); setRows(r.data); } catch { toast.error("Erreur"); } };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);
  const moderate = async (id, status) => { await api.patch(`/reviews/${id}`, { status }); toast.success(status==="approved"?"Approuvé":"Rejeté"); load(); };
  const del = async (id) => { if(!confirm("Supprimer ?"))return; await api.delete(`/reviews/${id}`); load(); };

  return (
    <div className="space-y-5">
      <div><h1 className="font-serif text-3xl">Avis clientes</h1><p className="text-sm text-[#666]">Modération des avis avant publication sur le site</p></div>

      <div className="flex gap-1 bg-[#f5f5f5] p-1 rounded-lg w-fit">
        {["pending","approved","rejected"].map(s=><button key={s} onClick={()=>setTab(s)} className={`px-4 py-1.5 text-sm rounded-md capitalize ${tab===s?"bg-white shadow-sm font-semibold":""}`} data-testid={`reviews-tab-${s}`}>{s==="pending"?"En attente":s==="approved"?"Approuvés":"Rejetés"}</button>)}
      </div>

      <div className="dina-card-white p-5">
        <div className="font-semibold mb-3">{rows.length} avis</div>
        {rows.length === 0 ? <div className="text-center text-sm text-[#666] py-8">Aucun avis.</div> :
          <div className="space-y-3">{rows.map(r=>(
            <div key={r.id} className="border border-[#ececec] rounded-xl p-4 flex gap-3" data-testid={`review-${r.id}`}>
              <div className="w-14 h-14 rounded-lg bg-[#fff5f5] overflow-hidden shrink-0">{r.product_image && <img src={r.product_image} alt="" className="w-full h-full object-cover"/>}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[#b02a2a] uppercase tracking-wide">{r.product_name}</div>
                <div className="flex items-center gap-2 mt-1 mb-1"><span className="font-medium text-sm">{r.customer_name}</span>{[1,2,3,4,5].map(i=><Star key={i} size={12} className={i<=r.rating?"fill-[#f4b12c] text-[#f4b12c]":"text-[#ddd]"}/>)}<span className="text-xs text-[#999]">{dateFmt(r.created_at)}</span></div>
                {r.comment && <p className="text-sm text-[#666]">{r.comment}</p>}
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                {r.status !== "approved" && <button onClick={()=>moderate(r.id,"approved")} className="dina-btn-primary !min-h-[32px] !px-3 text-xs" data-testid={`approve-${r.id}`}><Check size={12}/>Approuver</button>}
                {r.status !== "rejected" && <button onClick={()=>moderate(r.id,"rejected")} className="dina-btn-secondary !min-h-[32px] !px-3 text-xs" data-testid={`reject-${r.id}`}><X size={12}/>Rejeter</button>}
                <button onClick={()=>del(r.id)} className="dina-btn-danger !min-h-[32px] !px-3 text-xs"><Trash2 size={12}/></button>
              </div>
            </div>
          ))}</div>
        }
      </div>
    </div>
  );
}
