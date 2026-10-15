import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { fcfa, dateFmt, dateTimeFmt } from "@/lib/format";
import { toast } from "sonner";
import { ChevronLeft, Phone, MessageSquare, Copy, Send, X } from "lucide-react";
import SmartImage from "@/components/shared/SmartImage";
import { WalletLedger } from "@/components/shared/WalletLedger";

function ConsoleWallet({ cid, onChange }) {
  const [w, setW] = useState(null);
  const [f, setF] = useState({ amount: "", reason: "", source: "promotion" });
  const load = () => api.get(`/customers/${cid}/wallet`).then(r => setW(r.data)).catch(() => {});
  useEffect(() => { load(); }, [cid]); // eslint-disable-line
  const adjust = async () => {
    try { await api.post(`/customers/${cid}/wallet/adjust`, { amount: Number(f.amount), reason: f.reason, source: f.source }); toast.success("Porte-monnaie mis à jour"); setF({ amount: "", reason: "", source: "promotion" }); load(); onChange?.(); }
    catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
  };
  if (!w) return <div className="dina-card-white p-4 text-sm text-[#666]">Chargement…</div>;
  return (
    <div className="dina-card-white p-4 lg:col-span-2 space-y-3" data-testid="console-wallet">
      <div className="flex flex-wrap gap-4 items-end">
        <div><div className="text-xs text-[#666]">Disponible</div><div className="font-serif text-3xl text-[#5867fd]" data-testid="console-wallet-balance">{fcfa(w.balance)}</div></div>
        <div><div className="text-xs text-[#666]">En attente</div><div className="font-serif text-xl text-[#e4991e]">{fcfa(w.pending)}</div></div>
        <div><div className="text-xs text-[#666]">Utilisé</div><div className="font-serif text-xl">{fcfa(w.used_total)}</div></div>
        <div><div className="text-xs text-[#666]">Points</div><div className="font-serif text-xl">{w.points}</div></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[120px_150px_1fr_auto] gap-2" data-testid="console-wallet-adjust">
        <input className="dina-input" type="number" placeholder="± Montant" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} data-testid="wallet-adjust-amount"/>
        <select className="dina-input" value={f.source} onChange={e => setF({ ...f, source: e.target.value })} data-testid="wallet-adjust-source"><option value="promotion">Promotion</option><option value="remboursement">Remboursement</option><option value="correction">Correction</option><option value="autre">Autre</option></select>
        <input className="dina-input" placeholder="Motif (obligatoire)" value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} data-testid="wallet-adjust-reason"/>
        <button onClick={adjust} className="dina-btn-primary" data-testid="wallet-adjust-submit">Appliquer</button>
      </div>
      <WalletLedger rows={w.history} testid="console-wallet-history"/>
    </div>
  );
}

const TABS = [
  { k: "overview", label: "Aperçu" }, { k: "orders", label: "Commandes" }, { k: "payments", label: "Paiements" },
  { k: "favorites", label: "Favoris" }, { k: "recent", label: "Vus récemment" }, { k: "frequent", label: "Souvent consultés" },
  { k: "carts", label: "Paniers abandonnés" }, { k: "waitlist", label: "Liste d'attente" }, { k: "loyalty", label: "Fidélité" },
  { k: "referrals", label: "Parrainage" }, { k: "reviews", label: "Avis" }, { k: "messages", label: "Messages" },
  { k: "addresses", label: "Adresses" }, { k: "notes", label: "Notes" }, { k: "history", label: "Historique" },
];

export default function CustomerDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(params.get("tab") || "overview");

  const load = () => api.get(`/customers/${id}`).then(r => setData(r.data));
  useEffect(() => { load(); }, [id]);
  useEffect(() => { setParams({ tab }); }, [tab]);

  if (!data) return <div className="text-center py-12 text-sm text-[#666]">Chargement…</div>;
  const { customer: c, orders, metrics } = data;
  const avg = metrics.total_orders > 0 ? Math.round(metrics.total_spent / metrics.total_orders) : 0;

  const openWa = () => { const d = (c.phone || "").replace(/\D/g, ""); window.open(`https://wa.me/${d}?text=${encodeURIComponent(`Bonjour ${c.name?.split(" ")[0]} 💕`)}`, "_blank"); };

  return (
    <div className="space-y-5 font-sora">
      <button onClick={() => nav("/console/clients")} className="text-sm text-[#666] inline-flex items-center gap-1 hover:text-[#b02a2a]"><ChevronLeft size={13} />Retour</button>

      <div className="dina-card-white p-5 flex items-start gap-4 flex-wrap">
        {c.photo ? <SmartImage src={c.photo} alt={c.name} fallbackText={c.name} className="w-20 h-20 rounded-full object-cover" /> : <div className="w-20 h-20 rounded-full bg-[#fff5f5] text-[#b02a2a] grid place-items-center font-serif text-3xl font-bold">{c.name?.[0]}</div>}
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-2xl">{c.name}</h1>
          <div className="text-sm text-[#666]">{c.phone} · {c.email || "—"}</div>
          <div className="flex gap-2 mt-1 text-xs">
            <span className="dina-chip">{c.tier || "Bronze"}</span>
            <span className={`dina-chip ${c.status === "blacklist" ? "!text-[#c62828]" : "!text-[#1f8a4c] !border-[#1f8a4c]"}`}>{c.status === "blacklist" ? "Liste noire" : "Active"}</span>
            <span className="dina-chip">Depuis {dateFmt(c.created_at)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab("messages")} className="dina-btn-secondary !min-h-[36px]" data-testid="cust-detail-msg"><MessageSquare size={13} />Message</button>
          <button onClick={openWa} className="dina-btn-secondary !min-h-[36px] !text-[#1f8a4c]" data-testid="cust-detail-wa"><Phone size={13} />WhatsApp</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        <Kpi label="Total dépensé" v={fcfa(metrics.total_spent)} c="#b02a2a" />
        <Kpi label="Commandes" v={metrics.total_orders} c="#5867fd" />
        <Kpi label="Panier moy." v={fcfa(avg)} c="#1f8a4c" />
        <Kpi label="Points fidélité" v={c.loyalty_points || 0} c="#e4991e" />
        <Kpi label="Portefeuille" v={fcfa(c.wallet || 0)} c="#5867fd" />
      </div>

      <div className="flex gap-1 overflow-x-auto bg-[#f5f5f5] dark:bg-[#1a1a1a] p-1 rounded-lg">
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`px-3 py-1.5 text-xs rounded whitespace-nowrap ${tab === t.k ? "bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold" : ""}`} data-testid={`cust-tab-${t.k}`}>{t.label}</button>
        ))}
      </div>

      {tab === "overview" && <Overview c={c} orders={orders} metrics={metrics} />}
      {tab === "orders" && <OrdersList orders={orders} />}
      {tab === "payments" && <Payments c={c} orders={orders} onChange={load} />}
      {tab === "favorites" && <SimpleList title="Favoris" items={c.favorites_list || []} />}
      {tab === "recent" && <SimpleList title="Vus récemment" items={c.recently_viewed || []} />}
      {tab === "frequent" && <SimpleList title="Produits souvent consultés" items={c.often_viewed || []} />}
      {tab === "carts" && <SimpleList title="Paniers abandonnés" items={c.abandoned_carts || []} empty="Aucun panier abandonné" />}
      {tab === "waitlist" && <SimpleList title="Liste d'attente" items={c.waitlist_items || []} empty="Aucun produit en liste d'attente" />}
      {tab === "loyalty" && <Loyalty c={c} />}
      {tab === "referrals" && <Referrals c={c} />}
      {tab === "reviews" && <SimpleList title="Avis" items={c.reviews_list || []} empty="Aucun avis" />}
      {tab === "messages" && <Messages customerId={c.id} customerName={c.name} />}
      {tab === "addresses" && <Addresses addresses={c.addresses || []} />}
      {tab === "notes" && <Notes customer={c} onSaved={load} />}
      {tab === "history" && <History c={c} orders={orders} />}
    </div>
  );
}

function Kpi({ label, v, c }) { return <div className="dina-card-white p-3"><div className="text-[10px] uppercase text-[#666] font-semibold truncate">{label}</div><div className="font-serif tabular text-xl mt-1" style={{ color: c }}>{v}</div></div>; }

function Overview({ c, orders, metrics }) {
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="dina-card-white p-4"><div className="font-semibold mb-3">Produits préférés</div>{(metrics.top_products || []).length === 0 ? <div className="text-sm text-[#666]">Aucune donnée</div> : metrics.top_products.map((p, i) => (<div key={i} className="flex items-center gap-2 mb-2"><SmartImage src={p.image} alt={p.name} fallbackText={p.name} className="w-10 h-10 rounded object-cover" /><div className="flex-1 min-w-0"><div className="font-medium truncate">{p.name}</div><div className="text-[11px] text-[#666]">{p.qty} achetés · {fcfa(p.spent)}</div></div></div>))}</div>
      <div className="dina-card-white p-4"><div className="font-semibold mb-3">Préférences</div>
        <div className="text-xs space-y-1"><div>Pointure : <b>{c.shoe_size || "—"}</b></div><div>Taille haut : <b>{c.top_size || "—"}</b></div><div>Taille bas : <b>{c.bottom_size || "—"}</b></div><div>Couleurs/styles : <b>{c.preferences || "—"}</b></div><div>Marques préférées : <b>{c.favorite_brands || "—"}</b></div><div>Source : <b>{c.source || "—"}</b></div></div>
      </div>
    </div>
  );
}

function OrdersList({ orders }) {
  return orders.length === 0 ? <div className="dina-card-white p-6 text-center text-sm text-[#666]">Aucune commande</div> :
    <div className="dina-card-white overflow-x-auto"><table className="dina-table"><thead><tr><th>N°</th><th>Date</th><th>Articles</th><th>Statut</th><th className="text-right">Total</th></tr></thead>
      <tbody>{orders.map(o => <tr key={o.id}><td className="font-mono text-xs">{o.code}</td><td className="text-xs text-[#666]">{dateFmt(o.created_at)}</td><td className="text-xs">{(o.items || []).length}</td><td><span className="dina-chip text-[10px] capitalize">{o.status}</span></td><td className="text-right tabular font-semibold">{fcfa(o.total)}</td></tr>)}</tbody></table></div>;
}

function Payments({ c, orders, onChange }) {
  const methods = {};
  orders.forEach(o => { const m = o.payment_method || "cod"; methods[m] = (methods[m] || 0) + (o.total || 0); });
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="dina-card-white p-4"><div className="font-semibold mb-3">Méthodes utilisées</div>{Object.entries(methods).map(([k, v]) => <div key={k} className="flex justify-between text-sm py-1"><span className="capitalize">{k}</span><span className="tabular font-semibold">{fcfa(v)}</span></div>)}</div>
      <ConsoleWallet cid={c.id} onChange={onChange}/>
    </div>
  );
}

function SimpleList({ title, items, empty = "Aucun élément" }) {
  return <div className="dina-card-white p-4"><div className="font-semibold mb-3">{title}</div>{items.length === 0 ? <div className="text-sm text-[#666]">{empty}</div> : <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{items.map((p, i) => <div key={i} className="text-xs"><SmartImage src={p.image} alt={p.name} fallbackText={p.name} className="aspect-square object-cover rounded" /><div className="line-clamp-1 mt-1">{p.name}</div></div>)}</div>}</div>;
}

function Loyalty({ c }) {
  return <div className="dina-card-white p-5"><div className="font-serif text-3xl text-[#e4991e] tabular">{c.loyalty_points || 0}</div><div className="text-xs text-[#666] uppercase">Points fidélité · niveau {c.tier || "Bronze"}</div></div>;
}

function Referrals({ c }) {
  return <div className="dina-card-white p-5"><div className="text-xs uppercase text-[#666]">Code parrain personnel</div><div className="font-mono text-2xl text-[#b02a2a] mt-1">{c.referral_code}</div><button onClick={() => { navigator.clipboard.writeText(c.referral_code); toast.success("Copié"); }} className="dina-btn-secondary !min-h-[32px] text-xs mt-2"><Copy size={11} />Copier</button></div>;
}

function Addresses({ addresses }) {
  return addresses.length === 0 ? <div className="dina-card-white p-6 text-center text-sm text-[#666]">Aucune adresse</div> :
    <div className="grid md:grid-cols-2 gap-3">{addresses.map((a, i) => <div key={i} className="dina-card-white p-3"><div className="font-semibold text-sm">{a.label}</div><div className="text-xs text-[#666]">{a.commune} · {a.quartier}{a.repere && ` · ${a.repere}`}</div></div>)}</div>;
}

function Notes({ customer, onSaved }) {
  const [notes, setNotes] = useState(customer.notes || "");
  const save = async () => { try { await api.patch(`/customers/${customer.id}`, { notes }); toast.success("Enregistré"); onSaved(); } catch { toast.error("Erreur"); } };
  return <div className="dina-card-white p-4"><div className="font-semibold mb-2">Notes internes</div><textarea className="dina-input" rows={6} value={notes} onChange={e => setNotes(e.target.value)} data-testid="cust-notes" /><button onClick={save} className="dina-btn-primary mt-2" data-testid="cust-notes-save">Enregistrer</button></div>;
}

function History({ c, orders }) {
  const events = [{ at: c.created_at, label: `Inscription · ${c.name}` }, ...orders.slice(0, 20).map(o => ({ at: o.created_at, label: `Commande ${o.code} · ${fcfa(o.total)}` }))].sort((a, b) => b.at.localeCompare(a.at));
  return <div className="dina-card-white p-4"><div className="font-semibold mb-3">Historique</div>{events.map((e, i) => <div key={i} className="flex gap-3 text-xs py-1.5 border-b border-[#ececec] dark:border-[#2a2a2a]"><span className="text-[#999] tabular w-32 shrink-0">{dateTimeFmt(e.at)}</span><span>{e.label}</span></div>)}</div>;
}

function Messages({ customerId, customerName }) {
  const [convs, setConvs] = useState([]);
  const [active, setActive] = useState(null);
  const [text, setText] = useState("");
  const bottomRef = useRef();

  const load = async () => {
    const r = await api.get("/messages/conversations");
    const mine = (r.data || []).filter(c => (c.participants || []).some(p => p.id === customerId));
    setConvs(mine);
    if (!active && mine[0]) setActive(mine[0]);
  };
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [customerId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [active?.messages?.length]);

  const send = async () => {
    if (!text.trim()) return;
    try {
      const r = await api.post("/messages/send", { customer_id: customerId, text, kind: "boutique_cliente" });
      setText(""); toast.success("Envoyé");
      const full = await api.get(`/messages/conversations/${r.data.conversation_id}`);
      setActive(full.data); load();
    } catch { toast.error("Erreur"); }
  };

  return (
    <div className="dina-card-white p-4 min-h-[400px] flex flex-col">
      <div className="font-semibold mb-3">Conversation avec {customerName}</div>
      <div className="flex-1 overflow-y-auto bg-[#fafafa] dark:bg-[#0f0f0f] rounded-lg p-3 space-y-2 min-h-[300px]" data-testid="cust-chat">
        {!active || !active.messages?.length ? <div className="text-sm text-[#666] text-center py-10">Aucun message. Commencez la conversation.</div> :
          active.messages.map(m => (
            <div key={m.id} className={`flex ${m.from_kind === "store" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[70%] p-2.5 rounded-lg text-sm ${m.from_kind === "store" ? "bg-[#b02a2a] text-white" : "bg-white dark:bg-[#2a2a2a]"}`}>
                <div className="text-[10px] opacity-70 mb-0.5">{m.from_name} · {dateTimeFmt(m.at)}</div>
                <div>{m.text}</div>
                {m.image && <SmartImage src={m.image} alt="" fallbackIcon className="mt-1 rounded max-w-full" />}
              </div>
            </div>
          ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 mt-3">
        <input className="dina-input flex-1" placeholder="Tapez votre message…" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} data-testid="cust-msg-input" />
        <button onClick={send} className="dina-btn-primary" data-testid="cust-msg-send"><Send size={13} />Envoyer</button>
      </div>
    </div>
  );
}
