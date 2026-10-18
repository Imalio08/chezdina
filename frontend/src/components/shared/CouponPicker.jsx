import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Ticket, X } from "lucide-react";
import api from "@/lib/api";

// Discount code / voucher entry + list of the customer's usable coupons (storefront and POS)
export default function CouponPicker({ subtotal, fee = 0, value, onChange, pos = false, customerId, testid = "coupon" }) {
  const [code, setCode] = useState("");
  const [list, setList] = useState([]);
  const [busy, setBusy] = useState(false);
  const base = pos ? "/pos/coupons" : "/public/coupons";
  useEffect(() => {
    if (!subtotal) return;
    api.post(`${base}/available`, { subtotal, delivery_fee: fee, customer_id: customerId }).then(r => setList(r.data || [])).catch(() => setList([]));
  }, [base, subtotal, fee, customerId]);
  useEffect(() => {
    if (!value) return;
    api.post(`${base}/check`, { code: value.code, subtotal, delivery_fee: fee, customer_id: customerId })
      .then(r => { if (r.data.discount !== value.discount) onChange(r.data); })
      .catch(e => { onChange(null); toast.error(e.response?.data?.detail || "Code retiré"); });
  }, [subtotal, fee, customerId]); // eslint-disable-line react-hooks/exhaustive-deps
  const apply = async (c) => {
    const k = (c || code).trim();
    if (!k) return;
    setBusy(true);
    try { const r = await api.post(`${base}/check`, { code: k, subtotal, delivery_fee: fee, customer_id: customerId }); onChange(r.data); setCode(""); toast.success(`Code ${r.data.code} appliqué`); }
    catch (e) { toast.error(e.response?.data?.detail || "Code invalide"); }
    finally { setBusy(false); }
  };
  if (value) return (
    <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[#f0f9f4] border border-[#bfe3cc] text-sm" data-testid={`${testid}-applied`}>
      <span className="flex items-center gap-2"><Ticket size={14} className="text-[#1f8a4c]"/><b>{value.code}</b><span className="text-[#1f8a4c]">{value.label}</span></span>
      <button type="button" onClick={() => onChange(null)} aria-label="Retirer le code" className="text-[#666]" data-testid={`${testid}-remove`}><X size={14}/></button>
    </div>
  );
  const usable = list.filter(x => x.usable);
  return (
    <div className="space-y-2" data-testid={testid}>
      <div className="flex gap-2">
        <input className="dina-input flex-1 !min-h-[38px] uppercase" placeholder="Code promo ou bon d'achat" value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); apply(); } }} data-testid={`${testid}-input`}/>
        <button type="button" onClick={() => apply()} disabled={busy || !code.trim()} className="dina-btn-secondary !min-h-[38px] text-xs" data-testid={`${testid}-apply`}>Appliquer</button>
      </div>
      {usable.length > 0 && (
        <div className="flex flex-wrap gap-1.5" data-testid={`${testid}-available`}>
          {usable.map(c => <button key={c.code} type="button" onClick={() => apply(c.code)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-[#b02a2a] text-[#b02a2a] text-xs hover:bg-[#fff5f5]" data-testid={`${testid}-pick-${c.code}`}><Ticket size={11}/>{c.code} · {c.label}</button>)}
        </div>
      )}
    </div>
  );
}
