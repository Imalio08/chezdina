import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa, dateTimeFmt } from "@/lib/format";
import { toast } from "sonner";
import { PlayCircle, StopCircle, Shield } from "lucide-react";

export default function CashSessions() {
  const [sessions, setSessions] = useState([]);
  const [opening, setOpening] = useState(false);
  const [closingFor, setClosingFor] = useState(null);
  const [openCash, setOpenCash] = useState(0);
  const load = () => api.get("/cash-sessions").then(r => setSessions(r.data)).catch(() => { });
  useEffect(() => { load(); }, []);
  const open = async () => {
    try { await api.post("/cash-sessions/open", { opening_cash: +openCash }); toast.success("Session ouverte"); setOpening(false); setOpenCash(0); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
  };
  const current = sessions.find(s => !s.closed);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Sessions de caisse</h1><p className="text-sm text-[#666]">Ouverture, mouvements et clôture avec PIN gérante</p></div>
        {!current && <button onClick={() => setOpening(true)} className="dina-btn-primary !min-h-[40px]" data-testid="cash-open"><PlayCircle size={14} />Ouvrir caisse</button>}
        {current && <button onClick={() => setClosingFor(current)} className="dina-btn-primary !min-h-[40px]" style={{ background: "#c62828" }} data-testid="cash-close"><StopCircle size={14} />Clôturer</button>}
      </div>
      {current && (
        <div className="dina-card-white p-5">
          <div className="font-serif text-xl mb-3">Session en cours · {current.opened_by}</div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KPI label="Fond initial" value={fcfa(current.opening_cash)} />
            <KPI label="Ouverte depuis" value={dateTimeFmt(current.opened_at)} />
            <KPI label="Statut" value="Ouverte" color="#1f8a4c" />
            <KPI label="Note" value={current.note || "—"} />
          </div>
        </div>
      )}
      <div className="dina-card-white overflow-hidden">
        <div className="font-semibold p-4">Historique ({sessions.length})</div>
        <table className="dina-table">
          <thead><tr><th>Ouverte</th><th>Fermée</th><th>Par</th><th>Approuvée</th><th className="text-right">Fond</th><th className="text-right">Ventes espèces</th><th className="text-right">Attendu</th><th className="text-right">Compté</th><th className="text-right">Écart</th></tr></thead>
          <tbody>{sessions.map(s => (
            <tr key={s.id} data-testid={`cash-row-${s.id}`}>
              <td className="text-xs">{dateTimeFmt(s.opened_at)}</td>
              <td className="text-xs">{s.closed_at ? dateTimeFmt(s.closed_at) : <span className="text-[#1f8a4c]">en cours</span>}</td>
              <td>{s.opened_by}</td>
              <td className="text-[#666]">{s.approved_by || "—"}</td>
              <td className="text-right tabular">{fcfa(s.opening_cash)}</td>
              <td className="text-right tabular">{fcfa(s.cash_sales || 0)}</td>
              <td className="text-right tabular">{fcfa(s.expected || 0)}</td>
              <td className="text-right tabular font-semibold">{s.closing_cash != null ? fcfa(s.closing_cash) : "—"}</td>
              <td className={`text-right tabular font-semibold ${s.ecart > 0 ? "text-[#1f8a4c]" : s.ecart < 0 ? "text-[#c62828]" : ""}`}>{s.ecart != null ? (s.ecart > 0 ? "+" : "") + fcfa(s.ecart) : "—"}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {opening && (
        <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4" onClick={() => setOpening(false)}>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="font-serif text-xl mb-4">Ouvrir une session</div>
            <label className="text-xs uppercase text-[#666]">Fond de caisse (FCFA)</label>
            <input type="number" className="dina-input mt-1 mb-4 tabular text-right" value={openCash} onChange={e => setOpenCash(e.target.value)} data-testid="cash-open-amount" />
            <div className="flex gap-2"><button onClick={() => setOpening(false)} className="dina-btn-secondary flex-1">Annuler</button><button onClick={open} className="dina-btn-primary flex-1" data-testid="cash-open-confirm">Ouvrir</button></div>
          </div>
        </div>
      )}
      {closingFor && <CloseModal session={closingFor} onClose={() => setClosingFor(null)} onDone={() => { setClosingFor(null); load(); }} />}
    </div>
  );
}

function CloseModal({ session, onClose, onDone }) {
  const [closing, setClosing] = useState(0);
  const [pin, setPin] = useState("");
  const [note, setNote] = useState("");
  const submit = async () => {
    if (pin.length < 4) return toast.error("PIN gérante requis");
    try { const r = await api.post(`/cash-sessions/${session.id}/close`, { closing_cash: +closing, pin, note }); toast.success(`Clôturée · écart ${fcfa(r.data.summary.ecart)}`); onDone(); }
    catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
  };
  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="font-serif text-xl mb-4">Clôturer la caisse</div>
        <label className="text-xs uppercase text-[#666]">Espèces comptées (FCFA)</label>
        <input type="number" className="dina-input mt-1 mb-3 tabular text-right text-lg" value={closing} onChange={e => setClosing(e.target.value)} data-testid="cash-close-amount" />
        <label className="text-xs uppercase text-[#666] flex items-center gap-1"><Shield size={11} />PIN gérante</label>
        <input type="password" inputMode="numeric" maxLength={6} className="dina-input mt-1 mb-3 tracking-[0.5em] text-center text-lg" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} data-testid="cash-close-pin" />
        <textarea className="dina-input mb-3" rows={2} placeholder="Note (optionnelle)" value={note} onChange={e => setNote(e.target.value)} />
        <div className="flex gap-2"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={submit} className="dina-btn-primary flex-1" data-testid="cash-close-confirm">Clôturer</button></div>
      </div>
    </div>
  );
}

function KPI({ label, value, color }) {
  return <div className="p-3 bg-[#fff5f5] dark:bg-[#2a1818] rounded-lg"><div className="text-[10px] uppercase text-[#666]">{label}</div><div className="font-serif text-base tabular mt-0.5" style={color ? { color } : {}}>{value}</div></div>;
}
