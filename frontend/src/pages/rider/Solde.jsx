import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import SubPage from "@/components/rider/SubPage";
import { toast } from "sonner";

const ecartOf = (s) => Object.values(s.reconciliations || {}).reduce((a, r) => a + (typeof r === "object" ? r.ecart || 0 : 0), 0);

export default function Solde() {
  const [today, setToday] = useState(null);
  const [hist, setHist] = useState([]);
  const [rejected, setRejected] = useState([]);
  const loadRejected = () => api.get("/riders/me/versements-rejetes").then(r => setRejected(r.data || [])).catch(() => {});
  useEffect(() => {
    api.get("/riders/me/today").then(r => setToday(r.data)).catch(() => setToday({}));
    api.get("/riders/me/history?days=30").then(r => setHist(r.data || [])).catch(() => {});
    loadRejected();
  }, []);
  const coll30 = hist.reduce((s, x) => s + (x.collected_total || 0), 0);
  const ecart30 = hist.reduce((s, x) => s + ecartOf(x), 0);
  return (
    <SubPage title="Mon solde" testid="rider-solde-page">
      {!today ? <div className="text-sm text-[#666] text-center py-10">Chargement…</div> : <>
        <div className="dina-card-white p-5 text-center" data-testid="solde-to-hand">
          <div className="text-[10px] uppercase text-[#999]">À remettre à la boutique</div>
          <div className="font-serif text-4xl tabular text-[#b02a2a] mt-1">{fcfa(today.balance_to_hand_over || 0)}</div>
          <div className="text-xs text-[#666] mt-1">Espèces encaissées aujourd'hui, pas encore versées</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Box label="Encaissé aujourd'hui" v={fcfa(today.collected || 0)} c="#1f8a4c" t="solde-collected"/>
          <Box label="Reste à encaisser" v={fcfa(today.to_collect || 0)} c="#e4991e" t="solde-to-collect"/>
          <Box label="Encaissé sur 30 jours" v={fcfa(coll30)} t="solde-30"/>
          <Box label="Écarts sur 30 jours" v={fcfa(ecart30)} c={ecart30 >= 0 ? "#1f8a4c" : "#c62828"} t="solde-ecart"/>
        </div>
        {rejected.length > 0 && <RejectedList rows={rejected} onDone={loadRejected}/>}
        <div className="text-[11px] text-[#666] px-1">Le détail jour par jour est dans Profil › Historique.</div>
      </>}
    </SubPage>
  );
}

function RejectedRow({ r, onDone }) {
  const [amount, setAmount] = useState(r.due || "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try { await api.post(`/riders/me/versements/${r.session_id}/${r.order_id}/resubmit`, { amount: +amount, note }); toast.success("Correction envoyée à la gérante"); onDone(); }
    catch (e) { toast.error(e.response?.data?.detail || "Envoi impossible"); }
    finally { setBusy(false); }
  };
  return (
    <div className="border border-[#f3c9c9] rounded-lg p-3 space-y-1.5" data-testid={`rejected-versement-${r.code}`}>
      <div className="flex justify-between text-sm"><b>{r.code}</b><span className="text-[#c62828] text-xs font-semibold">{r.category_label}</span></div>
      <div className="text-xs text-[#666]">« {r.reason} » · {r.rejected_by}</div>
      <div className="text-xs tabular">Attendu {fcfa(r.due || 0)}{r.declared != null ? ` · remis ${fcfa(r.declared)} · écart ${fcfa(r.ecart || 0)}` : ""}</div>
      {r.resubmitted ? <div className="text-xs text-[#e4991e] font-semibold" data-testid={`rejected-resubmitted-${r.code}`}>Correction envoyée : {fcfa(r.resubmitted.amount)} · en attente de la gérante</div> : (
        <div className="flex gap-2">
          <input type="number" className="dina-input tabular !min-h-[38px] flex-1" value={amount} onChange={e => setAmount(e.target.value)} data-testid={`resubmit-amount-${r.code}`}/>
          <input className="dina-input !min-h-[38px] flex-1" placeholder="Note" value={note} onChange={e => setNote(e.target.value)}/>
          <button disabled={busy} onClick={send} className="dina-btn-primary !min-h-[38px] text-xs" data-testid={`resubmit-${r.code}`}>Corriger</button>
        </div>
      )}
    </div>
  );
}

function RejectedList({ rows, onDone }) {
  return <div className="dina-card-white p-4 space-y-2" data-testid="solde-rejected"><div className="font-semibold text-sm text-[#c62828]">Versements rejetés à corriger</div>{rows.map(r => <RejectedRow key={r.session_id + r.order_id} r={r} onDone={onDone}/>)}</div>;
}

function Box({ label, v, c, t }) { return <div className="dina-card-white p-3" data-testid={t}><div className="text-[10px] uppercase text-[#999]">{label}</div><div className="font-serif text-lg tabular mt-0.5" style={{ color: c }}>{v}</div></div>; }
