import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Save, Zap, Image as ImageIcon, Printer } from "lucide-react";

export default function Integrations() {
  const [f, setF] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get("/integrations").then(r => setF(r.data || {})).catch(() => { }); }, []);
  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...f };
      if (f.whatsapp_meta_token?.startsWith("****")) delete payload.whatsapp_meta_token;
      await api.patch("/integrations", payload);
      toast.success("Intégrations enregistrées");
    } catch { toast.error("Erreur"); } finally { setSaving(false); }
  };
  const S = ({ icon: Icon, title, children }) => (
    <div className="dina-card-white p-5">
      <div className="font-semibold mb-3 flex items-center gap-2"><Icon size={16} className="text-[#b02a2a]" />{title}</div>
      {children}
    </div>
  );
  const Field = ({ label, children }) => <div className="mb-3"><label className="text-xs uppercase font-semibold text-[#999]">{label}</label>{children}</div>;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Intégrations</h1><p className="text-sm text-[#666]">WhatsApp Meta, Pixels, imprimante Wi-Fi</p></div>
        <button onClick={save} disabled={saving} className="dina-btn-primary !min-h-[40px]" data-testid="integ-save"><Save size={14} />{saving ? "…" : "Enregistrer"}</button>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <S icon={Zap} title="WhatsApp Business">
          <label className="flex items-center gap-2 text-sm mb-3"><input type="checkbox" checked={f.whatsapp_auto !== false} onChange={e => setF({ ...f, whatsapp_auto: e.target.checked })} className="accent-[#b02a2a]" data-testid="integ-wa-auto" />Messages automatiques sur changement de statut</label>
          <Field label="Token Meta (Cloud API)"><input type="password" className="dina-input" placeholder="EAAG…" value={f.whatsapp_meta_token || ""} onChange={e => setF({ ...f, whatsapp_meta_token: e.target.value })} data-testid="integ-wa-token" /></Field>
          <Field label="Phone number ID"><input className="dina-input" value={f.whatsapp_meta_phone_id || ""} onChange={e => setF({ ...f, whatsapp_meta_phone_id: e.target.value })} data-testid="integ-wa-phone" /></Field>
          <div className="text-xs text-[#666]">Sans token : les messages sont enfilés dans Campagnes WhatsApp pour envoi manuel 1-clic. Avec token : envoi auto via Meta Cloud API.</div>
        </S>
        <S icon={ImageIcon} title="Pixels Marketing">
          <Field label="Meta Pixel ID"><input className="dina-input" placeholder="123456789" value={f.meta_pixel_id || ""} onChange={e => setF({ ...f, meta_pixel_id: e.target.value })} data-testid="integ-meta-pixel" /></Field>
          <Field label="TikTok Pixel ID"><input className="dina-input" placeholder="CXXXXXXX" value={f.tiktok_pixel_id || ""} onChange={e => setF({ ...f, tiktok_pixel_id: e.target.value })} data-testid="integ-tt-pixel" /></Field>
          <div className="text-xs text-[#666]">Les pixels se chargent automatiquement sur la vitrine une fois enregistrés.</div>
        </S>
        <S icon={Printer} title="Imprimante Wi-Fi ESC/POS">
          <Field label="Adresse IP"><input className="dina-input" placeholder="192.168.1.50" value={f.wifi_printer_ip || ""} onChange={e => setF({ ...f, wifi_printer_ip: e.target.value })} data-testid="integ-print-ip" /></Field>
          <Field label="Port"><input type="number" className="dina-input" value={f.wifi_printer_port || 9100} onChange={e => setF({ ...f, wifi_printer_port: +e.target.value })} /></Field>
          <div className="text-xs text-[#666]">Imprimante thermique 80mm compatible ESC/POS sur le réseau local.</div>
        </S>
      </div>
    </div>
  );
}
