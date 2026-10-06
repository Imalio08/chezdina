import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Users, Package, BellRing, Trash2, ShoppingBag, Search as SearchIcon, Hash } from "lucide-react";
import KPICard from "@/components/shared/KPICard";

export default function Waitlist() {
  const [tab, setTab] = useState("groups");
  const [data, setData] = useState(null);
  const [out, setOut] = useState(null);
  const [open, setOpen] = useState(null);

  const load = async () => {
    const [g, o] = await Promise.all([
      api.get("/waitlist/grouped"),
      api.get("/out-of-catalog").catch(()=>({data:{keywords:[],total:0}})),
    ]);
    setData(g.data); setOut(o.data);
  };
  useEffect(() => { load(); }, []);

  const notify = async (wid, name) => {
    try { await api.post(`/waitlist/${wid}/notify`); toast.success(`Notification envoyée à ${name}`); load(); }
    catch { toast.error("Erreur"); }
  };
  const remove = async (wid) => {
    if (!confirm("Retirer de la liste d'attente ?")) return;
    await api.delete(`/waitlist/${wid}`); toast.success("Retiré"); load();
  };

  if (!data) return <div className="text-sm text-[#666] text-center py-10">Chargement…</div>;

  return (
    <div className="space-y-5" data-testid="waitlist-page">
      <div><h1 className="font-serif text-3xl">Liste d'attente</h1><p className="text-sm text-[#666]">Clientes qui attendent un produit, une taille ou une couleur</p></div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard testid="wl-pending" label="Demandes en attente" value={data.pending} icon={BellRing} color="#e4991e"/>
        <KPICard testid="wl-prods" label="Produits concernés" value={data.products_affected} icon={Package} color="#5867fd"/>
        <KPICard testid="wl-clients" label="Clientes concernées" value={data.customers_total} icon={Users} color="#b02a2a"/>
        <KPICard testid="wl-conv" label="Conversion après retour" value={`${data.conversion_pct}%`} icon={ShoppingBag} color="#1f8a4c"/>
      </div>

      <div className="flex gap-1 bg-[#f5f5f5] dark:bg-[#1a1a1a] p-1 rounded-lg w-fit">
        <button onClick={()=>setTab("groups")} className={`px-3 py-1.5 text-sm rounded-md ${tab==="groups"?"bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold":""}`} data-testid="wl-tab-groups">Groupés par produit ({data.groups?.length||0})</button>
        <button onClick={()=>setTab("ooc")} className={`px-3 py-1.5 text-sm rounded-md ${tab==="ooc"?"bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold":""}`} data-testid="wl-tab-ooc">Demandes hors catalogue ({out?.total||0})</button>
      </div>

      {tab === "groups" && (
        <div className="grid md:grid-cols-2 gap-3">
          {(data.groups||[]).length === 0 && <div className="col-span-full dina-card-white py-10 text-center text-sm text-[#666]">Aucune demande en attente</div>}
          {(data.groups||[]).map((g,i) => (
            <div key={i} className="dina-card-white p-4" data-testid={`wl-group-${i}`}>
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded bg-[#fff5f5] overflow-hidden shrink-0">{g.product?.image && <img src={g.product.image} alt="" className="w-full h-full object-cover"/>}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-serif text-base leading-tight">{g.product?.name || "Produit"}</div>
                  <div className="text-xs text-[#666]">{g.product?.brand} · {[g.size, g.color].filter(Boolean).join(" · ") || "Toutes variantes"}</div>
                  <div className="flex items-center gap-2 mt-1 text-xs"><Users size={11} className="text-[#b02a2a]"/><b>{(g.customers || []).length}</b> client{(g.customers || []).length>1?"es":"e"} en attente</div>
                </div>
              </div>
              <button onClick={()=>setOpen(open===i?null:i)} className="mt-3 text-xs text-[#5867fd] hover:underline" data-testid={`wl-expand-${i}`}>{open===i?"Masquer":"Voir les clientes"}</button>
              {open===i && (
                <div className="mt-2 space-y-1">
                  {g.customers.map(c => (
                    <div key={c.id} className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-[#f0f0f0] last:border-0">
                      <div className="flex-1 min-w-0"><div className="font-medium truncate">{c.name}</div><div className="text-[#666] truncate">{c.phone} · {new Date(c.created_at).toLocaleDateString("fr-FR")}</div></div>
                      <button onClick={()=>notify(c.id, c.name)} className="dina-chip !py-0.5 text-[10px] !border-[#1f8a4c] !text-[#1f8a4c]" data-testid={`wl-notify-${c.id}`}><BellRing size={10}/>Notifier</button>
                      <button onClick={()=>remove(c.id)} className="text-[#c62828]"><Trash2 size={11}/></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "ooc" && (
        <div className="dina-card-white overflow-hidden">
          {(out?.keywords||[]).length === 0 ? <div className="py-10 text-center text-sm text-[#666]">Aucune demande hors catalogue</div> :
            <table className="dina-table" data-testid="ooc-table">
              <thead><tr><th>Mot-clé / produit demandé</th><th className="text-right">Demandes</th><th>Dernière demande</th></tr></thead>
              <tbody>{(out?.keywords||[]).map(k => (
                <tr key={k.keyword}>
                  <td className="font-medium">{k.keyword}</td>
                  <td className="text-right tabular font-semibold">{k.count}</td>
                  <td className="text-xs text-[#666]">{k.requests[0]?.customer_phone || "—"} · {new Date(k.requests[0]?.created_at).toLocaleDateString("fr-FR")}</td>
                </tr>
              ))}</tbody>
            </table>
          }
        </div>
      )}
    </div>
  );
}
