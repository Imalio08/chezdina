import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Phone, MessageCircle, MapPin, Clock, Mail, Send } from "lucide-react";

export default function Contact() {
  const [biz, setBiz] = useState({});
  const [hours, setHours] = useState([]);
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/public/business").then(r => setBiz(r.data || {})).catch(() => {});
    api.get("/public/site").then(r => {
      const oh = r.data?.opening_hours;
      const DAYS = { mon: "Lundi", tue: "Mardi", wed: "Mercredi", thu: "Jeudi", fri: "Vendredi", sat: "Samedi", sun: "Dimanche" };
      setHours(Array.isArray(oh) ? oh : oh && typeof oh === "object" ? Object.entries(DAYS).filter(([k]) => oh[k]).map(([k, label]) => { const d = oh[k]; const sl = d.slots?.length ? d.slots : (d.open && d.close ? [{ start: d.open, end: d.close }] : []); return { day: label, open: !d.closed && sl.length > 0, start: d.open, end: d.close, ranges: sl.map(s => `${s.start} → ${s.end}`).join(" · ") }; }) : []);
    }).catch(() => {});
  }, []);

  const submit = async () => {
    if (!form.name || !form.message) return toast.error("Nom et message requis");
    setBusy(true);
    try {
      await api.post("/public/contact", form);
      toast.success("Message envoyé — nous vous répondrons rapidement");
      setForm({ name: "", phone: "", email: "", message: "" });
    } catch { toast.error("Erreur envoi"); } finally { setBusy(false); }
  };

  const waUrl = biz.whatsapp ? `https://wa.me/${(biz.whatsapp || "").replace(/\D/g, "")}` : "https://wa.me/2250777926179";

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 grid md:grid-cols-2 gap-8" data-testid="page-contact">
      <div>
        <h1 className="font-serif text-3xl mb-2">Contact</h1>
        <p className="text-sm text-[#666] mb-6">Nous sommes à votre écoute. Passez à la boutique, appelez-nous ou écrivez-nous — nous répondons en moins de 2 h.</p>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3"><MapPin size={16} className="text-[#b02a2a] mt-0.5"/><div><div className="font-semibold">Adresse</div><div className="text-[#666]">{biz.address || "Cocody, Abidjan"}</div></div></div>
          <div className="flex items-start gap-3"><Phone size={16} className="text-[#b02a2a] mt-0.5"/><div><div className="font-semibold">Téléphone</div><a href={`tel:${biz.phone || "+2250777926179"}`} className="text-[#5867fd] hover:underline">{biz.phone || "+225 07 77 92 61 79"}</a></div></div>
          <div className="flex items-start gap-3"><MessageCircle size={16} className="text-[#1f8a4c] mt-0.5"/><div><div className="font-semibold">WhatsApp</div><a href={waUrl} target="_blank" rel="noreferrer" className="text-[#1f8a4c] hover:underline">Démarrer une conversation</a></div></div>
          <div className="flex items-start gap-3"><Clock size={16} className="text-[#b02a2a] mt-0.5"/><div><div className="font-semibold">Horaires d'ouverture</div>{hours.length === 0 ? <div className="text-[#666]">Lun–Sam 09:00 → 19:00 · Dim fermé</div> : <ul className="text-[#666]">{hours.map(h => <li key={h.day}>{h.day} — {h.open ? (h.ranges || `${h.start} → ${h.end}`) : "Fermé"}</li>)}</ul>}</div></div>
        </div>
        <div className="mt-6 rounded-lg overflow-hidden border border-[#ececec]">
          <iframe title="Carte boutique" src={biz.lat && biz.lng ? `https://www.openstreetmap.org/export/embed.html?bbox=${biz.lng - 0.006}%2C${biz.lat - 0.004}%2C${biz.lng + 0.006}%2C${biz.lat + 0.004}&layer=mapnik&marker=${biz.lat}%2C${biz.lng}` : "https://www.openstreetmap.org/export/embed.html?bbox=-4.02%2C5.345%2C-3.98%2C5.375&layer=mapnik&marker=5.36%2C-4.00"} width="100%" height="220" frameBorder="0" style={{ border: 0 }} data-testid="contact-map"/>
          {biz.lat && biz.lng && <a href={`https://www.google.com/maps/dir/?api=1&destination=${biz.lat},${biz.lng}`} target="_blank" rel="noreferrer" className="text-xs text-[#b02a2a] underline inline-flex items-center gap-1 mt-1" data-testid="contact-directions"><MapPin size={12}/>Itinéraire vers la boutique</a>}
        </div>
      </div>
      <div>
        <h2 className="font-serif text-xl mb-3">Écrivez-nous</h2>
        <div className="dina-card p-5 space-y-3">
          <input className="dina-input" placeholder="Nom complet" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="contact-name"/>
          <input className="dina-input" placeholder="Téléphone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} data-testid="contact-phone"/>
          <input className="dina-input" placeholder="Email (facultatif)" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} data-testid="contact-email"/>
          <textarea rows={5} className="dina-input" placeholder="Votre message…" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} data-testid="contact-message"/>
          <button onClick={submit} disabled={busy} className="dina-btn-primary w-full" data-testid="contact-submit"><Send size={14}/>{busy ? "Envoi…" : "Envoyer le message"}</button>
        </div>
      </div>
    </div>
  );
}
