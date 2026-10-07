import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa, dateFmt } from "@/lib/format";
import { toast } from "sonner";
import { Download, MessageCircle, Eye, FileText } from "lucide-react";

export default function Invoicing() {
  const [i, setI] = useState([]);
  const [preview, setPreview] = useState(null);
  const [brand, setBrand] = useState({ logo: "", name: "Chez Dina", phone: "+225 07 77 92 61 79", address: "", email: "", tiktok: "@dinoush04" });
  const load = async () => { try { const r = await api.get("/invoices"); setI(r.data); } catch { toast.error("Erreur"); } };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    api.get("/public/site").then(r => { const s = r.data || {}; setBrand(b => ({ ...b, logo: s.logo || "", name: s.name || b.name })); }).catch(() => {});
    api.get("/public/business").then(r => { const d = r.data || {}; setBrand(b => ({ ...b, phone: d.phone || b.phone, address: d.address || b.address, email: d.email || b.email, tiktok: d.tiktok || b.tiktok })); }).catch(() => {});
  }, []);

  const shareWA = (inv) => {
    const text = `Facture ${inv.number} - ${fcfa(inv.total)} - ${brand.name}`;
    const phone = inv.customer?.phone?.replace(/\D/g,"") || "";
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
  };
  const downloadPdf = (inv) => {
    const logoHtml = brand.logo ? `<img src="${brand.logo}" alt="${brand.name}" style="height:48px;object-fit:contain"/>` : "";
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>${inv.number}</title><style>body{font-family:sans-serif;max-width:700px;margin:40px auto;padding:30px;color:#1c1c1c} .hdr{display:flex;align-items:center;gap:14px;border-bottom:2px solid #b02a2a;padding-bottom:14px;margin-bottom:14px} h1{color:#b02a2a;margin:0} .biz{font-size:11px;color:#666} table{width:100%;border-collapse:collapse;margin:20px 0} td{padding:8px;border-bottom:1px solid #eee}</style></head><body><div class="hdr">${logoHtml}<div><h1>${brand.name}</h1><div class="biz">${brand.address || ""}${brand.phone?` · ${brand.phone}`:""}${brand.email?` · ${brand.email}`:""}</div></div></div><p>Facture <b>${inv.number}</b><br>Date: ${dateFmt(inv.created_at)}<br>Cliente: ${inv.customer?.name||"—"}</p><table><tr><td colspan="2"><b>Articles</b></td></tr>${(inv.items||[]).map(it=>`<tr><td>${it.qty}× ${it.name}</td><td style="text-align:right">${fcfa(it.qty*it.price)}</td></tr>`).join("")}<tr><td><b>TOTAL</b></td><td style="text-align:right"><b>${fcfa(inv.total)}</b></td></tr></table><p style="color:#666;font-size:12px">Merci de votre confiance.<br>${brand.phone} · TikTok ${brand.tiktok}</p><script>setTimeout(()=>window.print(),500)</script></body></html>`);
  };

  return (
    <div className="space-y-5">
      <div><h1 className="font-serif text-3xl">Facturation</h1><p className="text-sm text-[#666]">Factures, aperçu, export PDF, partage WhatsApp</p></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Total factures</div><div className="font-serif text-2xl tabular">{i.length}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Payées</div><div className="font-serif text-2xl tabular text-[#1f8a4c]">{i.filter(x=>x.status==="paye").length}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">En attente</div><div className="font-serif text-2xl tabular text-[#e4991e]">{i.filter(x=>x.status!=="paye").length}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">CA facturé</div><div className="font-serif text-2xl tabular">{fcfa(i.reduce((s,x)=>s+(x.total||0),0))}</div></div>
      </div>

      <div className="dina-card-white overflow-hidden"><table className="dina-table">
        <thead><tr><th>N°</th><th>Date</th><th>Cliente</th><th>Commande</th><th>Statut</th><th className="text-right">Total</th><th></th></tr></thead>
        <tbody>{i.map(x=>(
          <tr key={x.id} data-testid={`invoice-${x.number}`}>
            <td className="font-mono text-xs font-semibold">{x.number}</td>
            <td className="text-[#666]">{dateFmt(x.created_at)}</td>
            <td>{x.customer?.name}</td>
            <td>{x.order_code}</td>
            <td><span className="dina-chip" style={{color:x.status==="paye"?"#1f8a4c":"#e4991e"}}>{x.status==="paye"?"Payée":"En attente"}</span></td>
            <td className="text-right tabular font-semibold">{fcfa(x.total)}</td>
            <td className="text-right whitespace-nowrap">
              <button onClick={()=>setPreview(x)} className="text-[#0021cc] mr-2" title="Aperçu"><Eye size={14}/></button>
              <button onClick={()=>downloadPdf(x)} className="text-[#1f8a4c] mr-2" title="PDF"><Download size={14}/></button>
              <button onClick={()=>shareWA(x)} className="text-[#25D366]" title="WhatsApp"><MessageCircle size={14}/></button>
            </td>
          </tr>
        ))}</tbody>
      </table></div>

      {preview && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={()=>setPreview(null)}>
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg font-sora" onClick={e=>e.stopPropagation()}>
            <div className="text-center mb-4">
              {biz.logo ? <img src={biz.logo} alt="Logo" className="h-14 w-14 mx-auto rounded-full object-cover bg-[#fde8e8]"/> : <div className="w-14 h-14 mx-auto rounded-full bg-[#fde8e8] grid place-items-center font-serif text-[#b02a2a] font-bold">{(biz.name || "CD").split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase() || "CD"}</div>}
              <div className="font-serif text-2xl mt-2">{biz.name || "Chez Dina"}</div><div className="text-xs text-[#666]">{biz.address || "Cocody Angré"} · {biz.phone || "+225 07 77 92 61 79"}</div>
            </div>
            <div className="border-t border-dashed my-3"/>
            <div className="text-sm space-y-1 mb-3"><div className="font-semibold">Facture {preview.number}</div><div className="text-[#666]">{dateFmt(preview.created_at)}</div><div className="text-[#666]">Cliente : {preview.customer?.name}</div></div>
            <div className="border-t border-dashed my-3"/>
            <div className="space-y-1 text-sm">{(preview.items||[]).map((it,j)=><div key={j} className="flex justify-between"><span>{it.qty}× {it.name}</span><span className="tabular">{fcfa(it.qty*it.price)}</span></div>)}</div>
            <div className="border-t border-dashed my-3"/>
            <div className="flex justify-between font-bold text-lg"><span>TOTAL</span><span className="tabular text-[#b02a2a]">{fcfa(preview.total)}</span></div>
            <div className="flex gap-2 mt-5"><button onClick={()=>downloadPdf(preview)} className="dina-btn-secondary flex-1"><Download size={14}/>PDF</button><button onClick={()=>shareWA(preview)} className="dina-btn-primary flex-1"><MessageCircle size={14}/>WhatsApp</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
