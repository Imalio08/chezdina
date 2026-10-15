import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { toast } from "sonner";
import { ChevronLeft, Pencil, Copy, Printer, Share2, Tag, Archive, Clock, Package, History, BarChart3, Users, Star, Image as ImageIcon } from "lucide-react";
import SmartImage from "@/components/shared/SmartImage";

const STATUS_LABEL = { actif:"Actif", inactif:"Inactif", brouillon:"Brouillon", liste_attente:"Liste d'attente", archive:"Archivé" };
const STATUS_COLOR = { actif:"#1f8a4c", inactif:"#999", brouillon:"#5867fd", liste_attente:"#e4991e", archive:"#666" };

export default function ProductDetailView({ productId, onBack, onEdit }) {
  const [p, setP] = useState(null);
  const [tab, setTab] = useState("variants");
  const [imgIdx, setImgIdx] = useState(0);
  const [history, setHistory] = useState(null);

  useEffect(() => {
    api.get(`/public/product/${productId}`).then(r => setP(r.data));
    api.get(`/products/${productId}/history`).then(r => setHistory(r.data)).catch(()=>{});
  }, [productId]);

  if (!p) return <div className="p-10 text-sm text-[#666]">Chargement…</div>;

  const gallery = (p.images && p.images.length ? p.images : [p.image]).filter(Boolean);
  const status = p.status || "actif";
  const toggleStatus = async (newStatus) => {
    await api.patch(`/products/${p.id}`, { status: newStatus });
    toast.success(`Statut : ${STATUS_LABEL[newStatus]}`);
    api.get(`/public/product/${productId}`).then(r => setP(r.data));
  };
  const share = () => {
    const link = `${window.location.origin}/product/${p.id}`;
    navigator.clipboard?.writeText(link); toast.success("Lien produit copié");
  };
  const duplicate = async () => {
    const copy = { ...p, name: `${p.name} (copie)`, status: "brouillon" };
    delete copy.id; delete copy._id; delete copy.sku;
    await api.post("/products", copy); toast.success("Produit dupliqué");
  };

  const margePct = p.price && p.cost ? Math.round((p.price-p.cost)/p.price*100) : 0;
  const totalStock = Object.values(p.stock_by_size||{}).reduce((s,v)=>s+Number(v||0),0) || p.stock || 0;

  return (
    <div className="space-y-5" data-testid="product-detail-view">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button onClick={onBack} className="text-sm text-[#666] inline-flex items-center gap-1 hover:text-[#b02a2a]" data-testid="pdv-back"><ChevronLeft size={13}/>Retour aux produits</button>
        <div className="flex gap-1.5">
          <button onClick={share} className="dina-chip" data-testid="pdv-share"><Share2 size={11}/>Partager</button>
          <button onClick={duplicate} className="dina-chip" data-testid="pdv-duplicate"><Copy size={11}/>Dupliquer</button>
          <button onClick={()=>window.print()} className="dina-chip"><Printer size={11}/>Étiquettes</button>
          <button onClick={()=>toggleStatus(status==="actif"?"inactif":"actif")} className="dina-chip" data-testid="pdv-toggle-status">{status==="actif"?<Archive size={11}/>:<Package size={11}/>}{status==="actif"?"Désactiver":"Activer"}</button>
          <button onClick={()=>onEdit(p.id)} className="dina-btn-primary !min-h-[36px] text-xs" data-testid="pdv-edit"><Pencil size={12}/>Modifier</button>
        </div>
      </div>

      <div className="grid md:grid-cols-[400px_1fr] gap-6">
        {/* Gallery */}
        <div>
          <div className="aspect-square bg-[#fff5f5] rounded-xl overflow-hidden">
            {gallery.length ? <SmartImage src={gallery[imgIdx]} alt={p.name} fallbackText={p.name} className="w-full h-full object-cover" data-testid="pdv-main-img"/> : <div className="w-full h-full grid place-items-center text-[#999]"><ImageIcon size={32}/></div>}
          </div>
          {gallery.length > 1 && (
            <div className="grid grid-cols-5 gap-1.5 mt-2">
              {gallery.map((src,i)=><button key={i} onClick={()=>setImgIdx(i)} className={`aspect-square rounded-md overflow-hidden border-2 ${imgIdx===i?"border-[#b02a2a]":"border-transparent"}`} data-testid={`pdv-thumb-${i}`}><SmartImage src={src} alt={`${p.name} ${i+1}`} fallbackText={p.name} className="w-full h-full object-cover"/></button>)}
            </div>
          )}
        </div>

        {/* Infos */}
        <div>
          <div className="flex items-center gap-2 text-xs mb-1">
            <span className="text-[#b02a2a] uppercase tracking-wide font-semibold">{p.brand}</span>·<span className="text-[#666]">{p.category}</span>
            <span className="dina-chip !py-0.5 !px-2 text-[10px]" style={{color:STATUS_COLOR[status],borderColor:STATUS_COLOR[status]}}>{STATUS_LABEL[status]}</span>
          </div>
          <h1 className="font-serif text-3xl">{p.name}</h1>
          <div className="flex items-center gap-2 mt-2 text-sm">
            {p.rating_avg>0 && <><Star size={13} className="fill-[#f4b12c] text-[#f4b12c]"/><span>{p.rating_avg}</span><span className="text-[#999]">({p.rating_count} avis)</span>·</>}
            <span className="text-[#666]">SKU <code className="text-xs bg-[#f5f5f5] dark:bg-[#141414] px-1.5 py-0.5 rounded">{p.sku}</code></span>
            {p.barcode && <span className="text-[#666]">· {p.barcode}</span>}
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="dina-card-white p-3"><div className="text-[10px] uppercase text-[#666] font-semibold">Prix de vente</div><div className="font-serif text-xl tabular text-[#b02a2a]">{fcfa(p.price)}</div>{p.price_old && <div className="text-[10px] text-[#999] line-through">{fcfa(p.price_old)}</div>}</div>
            <div className="dina-card-white p-3"><div className="text-[10px] uppercase text-[#666] font-semibold">Prix d'achat</div><div className="font-serif text-xl tabular">{fcfa(p.cost||0)}</div></div>
            <div className="dina-card-white p-3"><div className="text-[10px] uppercase text-[#666] font-semibold">Marge</div><div className={`font-serif text-xl tabular ${margePct>=40?"text-[#1f8a4c]":margePct<20?"text-[#c62828]":"text-[#e4991e]"}`}>{margePct}%</div><div className="text-[10px] text-[#999]">{fcfa((p.price||0)-(p.cost||0))}</div></div>
          </div>

          {p.description && <p className="text-sm text-[#666] leading-relaxed mt-4">{p.description}</p>}

          {(p.material || p.season) && (
            <div className="flex gap-3 mt-3 text-xs text-[#666]">
              {p.material && <span><b>Matière :</b> {p.material}</span>}
              {p.season && <span><b>Saison :</b> {p.season}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div className="flex gap-1 border-b border-[#ececec] dark:border-[#2a2a2a] overflow-x-auto">
          {[["variants","Variantes & stock",Package],["sales","Ventes & marge",BarChart3],["history","Historique",History],["waitlist","Liste d'attente",Users]].map(([k,l,Icon])=>(
            <button key={k} onClick={()=>setTab(k)} className={`px-3 py-2 text-xs font-semibold border-b-2 whitespace-nowrap flex items-center gap-1 ${tab===k?"border-[#b02a2a] text-[#b02a2a]":"border-transparent text-[#666]"}`} data-testid={`pdv-tab-${k}`}><Icon size={12}/>{l}</button>
          ))}
        </div>

        {tab==="variants" && (
          <div className="mt-4 dina-card-white overflow-hidden">
            <table className="dina-table">
              <thead><tr><th>Taille</th><th>Couleurs</th><th className="text-right">Stock</th><th className="text-right">Valeur coût</th><th>Statut</th></tr></thead>
              <tbody>
                {(p.sizes||[]).map(s => {
                  const stk = Number(p.stock_by_size?.[s] ?? 0);
                  return (
                    <tr key={s}>
                      <td className="font-semibold">{s}</td>
                      <td className="text-xs text-[#666]">{(p.colors||[]).join(" · ") || "—"}</td>
                      <td className="text-right tabular"><span className={stk===0?"text-[#c62828] font-bold":stk<3?"text-[#e4991e] font-bold":""}>{stk}</span></td>
                      <td className="text-right tabular text-[#666]">{fcfa(stk*(p.cost||0))}</td>
                      <td>{stk===0 ? <span className="text-xs text-[#c62828]">Rupture</span> : stk<3 ? <span className="text-xs text-[#e4991e]">Stock bas</span> : <span className="text-xs text-[#1f8a4c]">Dispo</span>}</td>
                    </tr>
                  );
                })}
                {(p.sizes||[]).length === 0 && <tr><td colSpan={5} className="text-center text-sm text-[#666] py-6">Aucune variante · stock global : <b>{totalStock}</b></td></tr>}
                <tr className="font-semibold bg-[#fafafa] dark:bg-[#141414]"><td colSpan={2}>Total</td><td className="text-right tabular">{totalStock}</td><td className="text-right tabular">{fcfa(totalStock*(p.cost||0))}</td><td/></tr>
              </tbody>
            </table>
          </div>
        )}

        {tab==="sales" && history && (
          <div className="mt-4 grid md:grid-cols-3 gap-4">
            <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666] font-semibold">Ventes 30j</div><div className="font-serif text-3xl tabular mt-1">{history.sales_total}</div><div className="text-xs text-[#1f8a4c] tabular">{fcfa(history.sales_revenue)}</div></div>
            <div className="dina-card-white p-4 md:col-span-2"><div className="text-xs uppercase text-[#666] font-semibold mb-2">Dernières ventes</div>
              {history.sales.slice(0,8).length === 0 ? <div className="text-sm text-[#666]">Aucune vente</div> :
                history.sales.slice(0,8).map((s,i)=>(
                  <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-[#f0f0f0] last:border-0">
                    <span>{new Date(s.date).toLocaleDateString("fr-FR")} · {[s.size,s.color].filter(Boolean).join(" ")}</span>
                    <span className="tabular font-semibold">{s.qty}× {fcfa(s.price)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {tab==="history" && (
          <div className="mt-4 dina-card-white p-4 text-sm text-[#666]">Créé le {new Date(p.created_at).toLocaleDateString("fr-FR")} {p.updated_at && `· Modifié le ${new Date(p.updated_at).toLocaleDateString("fr-FR")}`}</div>
        )}

        {tab==="waitlist" && history && (
          <div className="mt-4 dina-card-white overflow-hidden">
            {history.waitlist.length === 0 ? <div className="p-8 text-center text-sm text-[#666]">Aucune cliente en attente pour ce produit</div> :
              <table className="dina-table">
                <thead><tr><th>Cliente</th><th>Téléphone</th><th>Taille</th><th>Depuis</th></tr></thead>
                <tbody>{history.waitlist.map(w=>(
                  <tr key={w.id}><td className="font-medium">{w.name}</td><td>{w.phone}</td><td className="font-semibold">{w.size||"Toutes"}</td><td className="text-xs text-[#666]">{new Date(w.created_at).toLocaleDateString("fr-FR")}</td></tr>
                ))}</tbody>
              </table>
            }
          </div>
        )}
      </div>
    </div>
  );
}
