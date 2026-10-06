import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Star, Check, X, Trash2, MessageSquareReply, Reply } from "lucide-react";
import { dateFmt } from "@/lib/format";

export default function Reviews() {
  const [tab, setTab] = useState("pending");
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [replyFor, setReplyFor] = useState(null);
  const [replyText, setReplyText] = useState("");

  const load = async () => {
    try {
      const [r, p, a, rj] = await Promise.all([
        api.get(`/reviews?status=${tab}`),
        api.get(`/reviews?status=pending`),
        api.get(`/reviews?status=approved`),
        api.get(`/reviews?status=rejected`),
      ]);
      setRows(r.data || []);
      setCounts({ pending: (p.data || []).length, approved: (a.data || []).length, rejected: (rj.data || []).length });
    } catch { toast.error("Erreur"); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  const avgRating = useMemo(() => {
    const all = rows.filter(r => r.rating);
    return all.length ? (all.reduce((s, r) => s + r.rating, 0) / all.length).toFixed(1) : "—";
  }, [rows]);

  const moderate = async (id, status) => {
    await api.patch(`/reviews/${id}`, { status });
    toast.success(status === "approved" ? "Approuvé" : "Rejeté");
    load();
  };
  const del = async (id) => { if (!confirm("Supprimer ?")) return; await api.delete(`/reviews/${id}`); load(); };
  const sendReply = async () => {
    if (!replyText.trim()) return toast.error("Rédigez une réponse");
    await api.patch(`/reviews/${replyFor.id}`, { status: replyFor.status || "approved", reply: replyText });
    toast.success("Réponse publiée");
    setReplyFor(null); setReplyText("");
    load();
  };

  return (
    <div className="space-y-5" data-testid="reviews-page">
      <div><h1 className="font-serif text-3xl">Avis clientes</h1><p className="text-sm text-[#666]">Modération des avis avant publication sur la vitrine</p></div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KpiCard label="En attente" value={counts.pending} color="#e4991e" active={tab === "pending"} onClick={() => setTab("pending")} testid="rev-kpi-pending"/>
        <KpiCard label="Approuvés" value={counts.approved} color="#1f8a4c" active={tab === "approved"} onClick={() => setTab("approved")} testid="rev-kpi-approved"/>
        <KpiCard label="Rejetés" value={counts.rejected} color="#c62828" active={tab === "rejected"} onClick={() => setTab("rejected")} testid="rev-kpi-rejected"/>
        <KpiCard label="Note moyenne (page)" value={`${avgRating}/5`} color="#f4b12c" testid="rev-kpi-avg"/>
      </div>

      <div className="dina-card-white p-5">
        <div className="font-semibold mb-3">{rows.length} avis affiché(s)</div>
        {rows.length === 0 ? <div className="text-center text-sm text-[#666] py-12">Aucun avis dans cette catégorie</div> :
          <div className="space-y-3">{rows.map(r => (
            <div key={r.id} className="border border-[#ececec] dark:border-[#2a2a2a] rounded-xl p-4 flex gap-3" data-testid={`review-${r.id}`}>
              <div className="w-14 h-14 rounded-lg bg-[#fff5f5] overflow-hidden shrink-0">{r.product_image && <img src={r.product_image} alt="" className="w-full h-full object-cover"/>}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[#b02a2a] uppercase tracking-wide">{r.product_name}</div>
                <div className="flex items-center gap-2 mt-1 mb-1 flex-wrap"><span className="font-medium text-sm">{r.customer_name}</span>{[1,2,3,4,5].map(i=><Star key={i} size={12} className={i<=r.rating?"fill-[#f4b12c] text-[#f4b12c]":"text-[#ddd]"}/>)}<span className="text-xs text-[#999]">{dateFmt(r.created_at)}</span></div>
                {r.comment && <p className="text-sm text-[#666]">{r.comment}</p>}
                {r.reply && (
                  <div className="mt-2 ml-4 p-3 bg-[#fff5f5] dark:bg-[#2a1818] rounded-lg border-l-2 border-[#b02a2a]" data-testid={`review-reply-${r.id}`}>
                    <div className="text-[10px] uppercase text-[#b02a2a] font-semibold flex items-center gap-1"><Reply size={10}/>Chez Dina · {r.reply_by || "Équipe"}</div>
                    <div className="text-sm mt-0.5">{r.reply}</div>
                    <div className="text-[10px] text-[#999]">{dateFmt(r.reply_at)}</div>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                {r.status !== "approved" && <button onClick={()=>moderate(r.id,"approved")} className="dina-btn-primary !min-h-[32px] !px-3 text-xs" data-testid={`approve-${r.id}`}><Check size={12}/>Approuver</button>}
                {r.status !== "rejected" && <button onClick={()=>moderate(r.id,"rejected")} className="dina-btn-secondary !min-h-[32px] !px-3 text-xs" data-testid={`reject-${r.id}`}><X size={12}/>Rejeter</button>}
                {!r.reply && r.status === "approved" && <button onClick={() => { setReplyFor(r); setReplyText(""); }} className="dina-btn-secondary !min-h-[32px] !px-3 text-xs !text-[#5867fd]" data-testid={`reply-${r.id}`}><MessageSquareReply size={12}/>Répondre</button>}
                <button onClick={()=>del(r.id)} className="dina-btn-danger !min-h-[32px] !px-3 text-xs"><Trash2 size={12}/></button>
              </div>
            </div>
          ))}</div>
        }
      </div>

      {replyFor && (
        <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4" onClick={() => setReplyFor(null)}>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()} data-testid="reply-modal">
            <div className="font-serif text-xl mb-3">Répondre à {replyFor.customer_name}</div>
            <div className="text-xs text-[#666] mb-3 p-3 rounded bg-[#fafafa] dark:bg-[#141414] italic">"{replyFor.comment}"</div>
            <label className="text-xs uppercase text-[#666] font-semibold">Votre réponse publique</label>
            <textarea className="dina-input mt-1 mb-4" rows={4} value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Merci pour votre retour, …" autoFocus data-testid="reply-text"/>
            <div className="flex gap-2"><button onClick={() => setReplyFor(null)} className="dina-btn-secondary flex-1">Annuler</button><button onClick={sendReply} className="dina-btn-primary flex-1" data-testid="reply-send"><MessageSquareReply size={13}/>Publier la réponse</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, color, active, onClick, testid }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={`dina-card-white p-4 text-left transition ${active ? "ring-2" : ""}`} style={active ? { "--tw-ring-color": color } : {}} data-testid={testid}>
      <div className="text-xs uppercase text-[#666] font-semibold">{label}</div>
      <div className="font-serif text-3xl tabular mt-1" style={{color}}>{value}</div>
    </Tag>
  );
}
