import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { fcfa, dateTimeFmt } from "@/lib/format";
import { toast } from "sonner";
import { PlayCircle, StopCircle, Shield, HandCoins, CheckCircle, AlertTriangle, Clock, XCircle, X } from "lucide-react";

export default function CashSessions() {
  const { user } = useAuth();
  const isOwner = user?.role === "admin";
  const [sessions, setSessions] = useState([]);
  const [opening, setOpening] = useState(false);
  const [closingFor, setClosingFor] = useState(null);
  const [handoverFor, setHandoverFor] = useState(null);
  const [validateFor, setValidateFor] = useState(null);
  const [rejectFor, setRejectFor] = useState(null);

  const load = () => api.get("/cash-sessions").then(r => setSessions(r.data || [])).catch(() => { });
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);


  const current = sessions.find(s => !s.closed);
  const pendingValidation = sessions.filter(s => s.status === "pending_validation");

  const kpis = useMemo(() => ({
    total_cash: sessions.filter(s => s.closed).reduce((a, s) => a + (s.cash_sales || 0), 0),
    gap: sessions.reduce((a, s) => a + (s.ecart || 0) + (s.validation_gap || 0), 0),
    pending: pendingValidation.length,
    sessions_total: sessions.length,
  }), [sessions, pendingValidation.length]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Journée de caisse</h1><p className="text-sm text-[#666]">Ouvrir ma journée · versement à la propriétaire · validation · écarts comptabilisés</p></div>
        <div className="flex gap-2 flex-wrap">
          {!current && <button onClick={() => setOpening(true)} className="dina-btn-primary !min-h-[44px] !text-base !px-6" data-testid="cash-open"><PlayCircle size={16} />Ouvrir une session</button>}
          {current && current.status !== "pending_validation" && <button onClick={() => setClosingFor(current)} className="dina-btn-primary !min-h-[40px]" style={{ background: "#c62828" }} data-testid="cash-close"><StopCircle size={14} />Clôturer la journée</button>}
        </div>
      </div>

      {!current && (
        <div className="dina-card-white p-5 border-2 border-dashed border-[#fde8e8] text-center" data-testid="cash-no-session">
          <PlayCircle size={32} className="mx-auto text-[#b02a2a] mb-2"/>
          <div className="font-serif text-xl">Aucune journée ouverte</div>
          <p className="text-sm text-[#666] mb-3">Vous devez ouvrir votre journée pour commencer à encaisser des ventes au comptoir.</p>
          <button onClick={() => setOpening(true)} className="dina-btn-primary !min-h-[40px]" data-testid="cash-open-empty"><PlayCircle size={14} />Ouvrir une session</button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Sessions" value={kpis.sessions_total} color="#1c1c1c" testid="cash-kpi-total"/>
        <KpiCard label="À valider (Owner)" value={kpis.pending} color="#e4991e" testid="cash-kpi-pending"/>
        <KpiCard label="Encaissements espèces cumulés" value={fcfa(kpis.total_cash)} color="#1f8a4c" testid="cash-kpi-cash"/>
        <KpiCard label="Écarts cumulés" value={fcfa(kpis.gap)} color={kpis.gap < 0 ? "#c62828" : kpis.gap > 0 ? "#1f8a4c" : "#666"} testid="cash-kpi-gap"/>
      </div>

      {current && (
        <div className="dina-card-white p-5" data-testid="cash-current-session">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="font-serif text-xl flex items-center gap-2">Session en cours · {current.opened_by}
                {current.status === "pending_validation" && <span className="dina-chip text-[10px] !text-[#e4991e] !border-[#e4991e]">En attente de validation Owner</span>}
              </div>
              <div className="text-xs text-[#666]" data-testid="cash-current-date">{current.session_date && <>Journée du {dateFr(current.session_date)} · </>}Ouverte {dateTimeFmt(current.opened_at)}</div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {!current.handover_at && (
                <button onClick={() => setHandoverFor(current)} className="dina-btn-secondary !min-h-[36px] !text-[#5867fd]" data-testid="cash-declare-handover"><HandCoins size={13}/>Déclarer versement</button>
              )}
              {current.status === "pending_validation" && isOwner && (
                <>
                  <button onClick={() => setValidateFor(current)} className="dina-btn-primary !min-h-[36px] !bg-[#1f8a4c]" data-testid="cash-validate-handover"><CheckCircle size={13}/>Valider versement</button>
                  <button onClick={() => setRejectFor(current)} className="dina-btn-secondary !min-h-[36px] !text-[#c62828] !border-[#c62828]" data-testid="cash-reject-handover"><XCircle size={13}/>Rejeter</button>
                </>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            <KPIsmall label="Fond initial" value={fcfa(current.opening_cash)} />
            <KPIsmall label="Versement déclaré" value={current.handover_amount != null ? fcfa(current.handover_amount) : "—"} color={current.handover_amount != null ? "#5867fd" : "#999"} />
            <KPIsmall label="Déclaré le" value={current.handover_at ? dateTimeFmt(current.handover_at) : "—"} />
            <KPIsmall label="Note Gérante" value={current.handover_note || "—"} />
          </div>
        </div>
      )}

      {isOwner && pendingValidation.length > 0 && (
        <div className="dina-card-white p-4 border-l-4 border-[#e4991e]" data-testid="cash-owner-queue">
          <div className="flex items-center gap-2 font-semibold mb-2 text-[#e4991e]"><AlertTriangle size={14}/>{pendingValidation.length} versement(s) à valider</div>
          <div className="text-xs text-[#666]">Cliquez sur « Valider versement » dans la session en cours ci-dessus, ou dans la ligne concernée dans l'historique.</div>
        </div>
      )}

      <div className="dina-card-white overflow-hidden">
        <div className="font-semibold p-4">Historique ({sessions.length})</div>
        <div className="overflow-x-auto">
          <table className="dina-table">
            <thead><tr>
              <th>Journée</th><th>Ouverte</th><th>Fermée</th><th>Par</th><th>Statut</th>
              <th className="text-right">Fond</th><th className="text-right">Ventes espèces</th><th className="text-right">Attendu</th>
              <th className="text-right">Compté</th><th className="text-right">Versé</th><th className="text-right">Écart owner</th><th></th>
            </tr></thead>
            <tbody>{sessions.length === 0 ? <tr><td colSpan={12} className="text-sm text-[#666] text-center py-8">Aucune session</td></tr>
            : sessions.map(s => (
              <tr key={s.id} data-testid={`cash-row-${s.id}`}>
                <td className="text-xs font-medium">{s.session_date ? dateFr(s.session_date) : "—"}</td>
                <td className="text-xs">{dateTimeFmt(s.opened_at)}</td>
                <td className="text-xs">{s.closed_at ? dateTimeFmt(s.closed_at) : <span className="text-[#1f8a4c]">en cours</span>}</td>
                <td>{s.opened_by}</td>
                <td><StatusBadge s={s}/></td>
                <td className="text-right tabular">{fcfa(s.opening_cash)}</td>
                <td className="text-right tabular">{fcfa(s.cash_sales || 0)}</td>
                <td className="text-right tabular">{fcfa(s.expected || 0)}</td>
                <td className="text-right tabular font-semibold">{s.closing_cash != null ? fcfa(s.closing_cash) : "—"}</td>
                <td className="text-right tabular">{s.handover_amount != null ? fcfa(s.handover_amount) : "—"}</td>
                <td className={`text-right tabular font-semibold ${s.validation_gap > 0 ? "text-[#1f8a4c]" : s.validation_gap < 0 ? "text-[#c62828]" : ""}`}>{s.validation_gap != null ? ((s.validation_gap > 0 ? "+" : "") + fcfa(s.validation_gap)) : "—"}</td>
                <td className="text-right">{s.status === "pending_validation" && isOwner && (
                  <button onClick={() => setValidateFor(s)} className="text-[#1f8a4c] text-xs font-semibold hover:underline" data-testid={`cash-validate-${s.id}`}>Valider</button>
                )}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      {current && current.status === "rejected" && current.rejection_reason && (
        <div className="dina-card-white p-4 border-l-4 border-[#c62828]" data-testid="handover-rejected-banner">
          <div className="flex items-center gap-2 font-semibold mb-1 text-[#c62828]"><XCircle size={14}/>Versement rejeté par le propriétaire</div>
          <div className="text-sm text-[#1c1c1c] dark:text-white italic">« {current.rejection_reason} »</div>
          <div className="text-xs text-[#666] mt-1">Rejeté par {current.rejected_by} le {dateTimeFmt(current.rejected_at)} — recomptez les espèces et déclarez un nouveau versement.</div>
        </div>
      )}

      {opening && <OpenModal user={user} onCancel={() => setOpening(false)} onDone={() => { setOpening(false); load(); }}/>}
      {closingFor && <CloseModal session={closingFor} onClose={() => setClosingFor(null)} onDone={() => { setClosingFor(null); load(); }} />}
      {handoverFor && <HandoverModal session={handoverFor} onClose={() => setHandoverFor(null)} onDone={() => { setHandoverFor(null); load(); }} />}
      {validateFor && <ValidateHandoverModal session={validateFor} onClose={() => setValidateFor(null)} onDone={() => { setValidateFor(null); load(); }} />}
      {rejectFor && <RejectHandoverModal session={rejectFor} onClose={() => setRejectFor(null)} onDone={() => { setRejectFor(null); load(); }} />}
    </div>
  );
}

function RejectHandoverModal({ session, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    const r = reason.trim();
    if (r.length < 5) return toast.error("Un motif clair est obligatoire (min. 5 caractères)");
    if (!window.confirm(`Rejeter le versement de ${session.handover_by || "la Gérante"} ?\n\nMotif : ${r}`)) return;
    setSubmitting(true);
    try {
      await api.post(`/cash-sessions/${session.id}/reject-handover`, { reason: r });
      toast.success("Versement rejeté · la Gérante en est informée");
      onDone();
    } catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
    finally { setSubmitting(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()} data-testid="reject-handover-modal">
        <div className="flex items-center justify-between mb-3">
          <div className="font-serif text-xl text-[#c62828]">Rejeter le versement</div>
          <button onClick={onClose}><X size={18}/></button>
        </div>
        <div className="p-3 rounded-lg bg-[#fff5f5] dark:bg-[#2a1818] text-xs mb-3">
          <div className="flex justify-between"><span className="text-[#666]">Déclaré par {session.handover_by}</span><span className="tabular font-semibold text-[#5867fd]">{fcfa(session.handover_amount || 0)}</span></div>
          <div className="flex justify-between text-[#666]"><span>Le</span><span>{dateTimeFmt(session.handover_at)}</span></div>
          {session.handover_note && <div className="mt-2 italic">« {session.handover_note} »</div>}
        </div>
        <label className="text-xs uppercase text-[#666] font-semibold">Motif du rejet (obligatoire) *</label>
        <textarea className="dina-input mt-1 mb-2" rows={3} placeholder="Ex. le montant déposé ne correspond pas aux espèces reçues, 5 000 FCFA en moins" value={reason} onChange={e => setReason(e.target.value)} data-testid="reject-reason" autoFocus/>
        <div className="text-xs text-[#666] mb-4">La Gérante verra ce motif et pourra re-déclarer un versement corrigé.</div>
        <div className="flex gap-2">
          <button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button>
          <button onClick={submit} disabled={submitting} className="dina-btn-primary flex-1 !bg-[#c62828]" data-testid="reject-confirm"><XCircle size={13}/>{submitting ? "Rejet…" : "Rejeter avec motif"}</button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ s }) {
  if (s.status === "rejected") return <span className="dina-chip text-[10px] !text-[#c62828] !border-[#c62828]"><XCircle size={9}/>Rejeté</span>;
  if (s.status === "pending_validation") return <span className="dina-chip text-[10px] !text-[#e4991e] !border-[#e4991e]"><Clock size={9}/>À valider</span>;
  if (s.status === "validated") return <span className="dina-chip text-[10px] !text-[#1f8a4c] !border-[#1f8a4c]"><CheckCircle size={9}/>Validée</span>;
  if (s.status === "gap") return <span className="dina-chip text-[10px] !text-[#c62828] !border-[#c62828]"><AlertTriangle size={9}/>Écart</span>;
  if (s.closed) return <span className="dina-chip text-[10px] !text-[#666]">Clôturée</span>;
  return <span className="dina-chip text-[10px] !text-[#1f8a4c] !border-[#1f8a4c]">Ouverte</span>;
}
function KpiCard({ label, value, color, testid }) {
  return <div className="dina-card-white p-3" data-testid={testid}><div className="text-[10px] uppercase text-[#666] font-semibold">{label}</div><div className="font-serif tabular text-xl mt-1" style={{ color }}>{value}</div></div>;
}
function KPIsmall({ label, value, color }) {
  return <div className="p-3 bg-[#fff5f5] dark:bg-[#2a1818] rounded-lg"><div className="text-[10px] uppercase text-[#666]">{label}</div><div className="font-serif text-sm tabular mt-0.5 truncate" style={color ? { color } : {}}>{value}</div></div>;
}

const todayLocal = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const dateFr = (iso) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };

export function OpenModal({ user, onCancel, onDone }) {
  const [managers, setManagers] = useState([]);
  const [managerId, setManagerId] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    api.get("/cash-sessions/managers").then(r => {
      const list = r.data || [];
      setManagers(list);
      setManagerId(list.find(m => m.id === user?.id)?.id || list[0]?.id || "");
    }).catch(() => toast.error("Impossible de charger les gérantes"));
  }, [user?.id]);
  const submit = async () => {
    if (!managerId) return toast.error("Choisissez une gérante");
    if (!date || date > todayLocal()) return toast.error("Date invalide : aujourd'hui ou une date passée");
    if (amount === "" || +amount < 0) return toast.error("Saisissez le fond de caisse");
    if (pin.length < 4) return toast.error("PIN de la gérante requis");
    setSubmitting(true);
    try {
      await api.post("/cash-sessions/open", { manager_id: managerId, session_date: date, opening_cash: +amount, pin, note });
      toast.success(`Session ouverte · fond ${fcfa(+amount)}`);
      onDone();
    } catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
    finally { setSubmitting(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()} data-testid="cash-open-modal">
        <div className="flex items-center justify-between mb-1"><div className="font-serif text-xl">Ouvrir une session</div><button onClick={onCancel} data-testid="cash-open-close"><X size={18}/></button></div>
        <p className="text-xs text-[#666] mb-4">Comptez le fond de caisse présent dans le tiroir avant d'ouvrir.</p>
        <label className="text-xs uppercase text-[#666] font-semibold">Gérante</label>
        <select className="dina-input mt-1 mb-3" value={managerId} onChange={e => setManagerId(e.target.value)} data-testid="cash-open-manager">
          {managers.map(m => <option key={m.id} value={m.id}>{m.name}{m.role === "admin" ? " (Admin)" : ""}</option>)}
        </select>
        <label className="text-xs uppercase text-[#666] font-semibold">Date de la journée</label>
        <input type="date" max={todayLocal()} className="dina-input mt-1 mb-3" value={date} onChange={e => setDate(e.target.value)} data-testid="cash-open-date"/>
        <label className="text-xs uppercase text-[#666] font-semibold">Fond de caisse (FCFA)</label>
        <input type="number" min="0" inputMode="numeric" className="dina-input mt-1 tabular text-right text-lg" value={amount} onChange={e => setAmount(e.target.value)} data-testid="cash-open-amount" placeholder="Ex. 50000"/>
        <div className="text-right text-xs text-[#b02a2a] font-semibold tabular mt-1 mb-3" data-testid="cash-open-amount-preview">{fcfa(+amount || 0)}</div>
        <label className="text-xs uppercase text-[#666] font-semibold flex items-center gap-1"><Shield size={11}/>PIN de la gérante</label>
        <input type="password" inputMode="numeric" maxLength={6} className="dina-input mt-1 mb-3 tracking-[0.5em] text-center text-lg" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} data-testid="cash-open-pin"/>
        <textarea className="dina-input mb-4" rows={2} placeholder="Note (facultative)" value={note} onChange={e => setNote(e.target.value)} data-testid="cash-open-note"/>
        <div className="flex gap-2"><button onClick={onCancel} className="dina-btn-secondary flex-1">Annuler</button><button onClick={submit} disabled={submitting} className="dina-btn-primary flex-1" data-testid="cash-open-confirm"><PlayCircle size={13}/>{submitting ? "Ouverture…" : "Ouvrir la session"}</button></div>
      </div>
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

function HandoverModal({ session, onClose, onDone }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const expected = (session.opening_cash || 0) + (session.cash_sales || 0);
  const submit = async () => {
    const n = parseInt(amount || "0", 10);
    if (Number.isNaN(n) || n < 0) return toast.error("Montant invalide");
    setSubmitting(true);
    try { await api.post(`/cash-sessions/${session.id}/declare-handover`, { amount: n, note }); toast.success("Versement déclaré · en attente du propriétaire"); onDone(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
    finally { setSubmitting(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()} data-testid="handover-modal">
        <div className="font-serif text-xl mb-3">Déclarer un versement au propriétaire</div>
        <div className="p-3 rounded-lg bg-[#f5f5f5] dark:bg-[#141414] text-xs mb-3">
          <div className="flex justify-between"><span className="text-[#666]">Fond initial</span><span className="tabular font-semibold">{fcfa(session.opening_cash || 0)}</span></div>
          <div className="flex justify-between"><span className="text-[#666]">Ventes espèces (indicatif)</span><span className="tabular font-semibold">{fcfa(session.cash_sales || 0)}</span></div>
          <div className="flex justify-between mt-1 pt-1 border-t border-[#ececec] dark:border-[#2a2a2a]"><span className="text-[#666]">Attendu</span><span className="tabular font-semibold text-[#b02a2a]">{fcfa(expected)}</span></div>
        </div>
        <label className="text-xs uppercase text-[#666] font-semibold">Montant versé réellement (FCFA)</label>
        <input type="number" min="0" inputMode="numeric" className="dina-input mt-1 mb-3 tabular text-right text-lg" value={amount} onChange={e => setAmount(e.target.value)} data-testid="handover-amount" autoFocus/>
        <label className="text-xs uppercase text-[#666] font-semibold">Note (facultatif)</label>
        <textarea className="dina-input mt-1 mb-4" rows={2} placeholder="Ex. une partie du fond gardée pour le change" value={note} onChange={e => setNote(e.target.value)} data-testid="handover-note"/>
        <div className="flex gap-2"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={submit} disabled={submitting} className="dina-btn-primary flex-1" data-testid="handover-confirm"><HandCoins size={13}/>Déclarer</button></div>
      </div>
    </div>
  );
}

function ValidateHandoverModal({ session, onClose, onDone }) {
  const expected = session.handover_amount || 0;
  const [actual, setActual] = useState(expected);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const gap = (+actual || 0) - expected;
  const submit = async () => {
    setSubmitting(true);
    try {
      const r = await api.post(`/cash-sessions/${session.id}/validate-handover`, { expected, actual: +actual || 0, note });
      toast.success(r.data.gap === 0 ? "Versement validé sans écart" : `Validé · écart ${fcfa(r.data.gap)} appliqué au solde Gérante`);
      onDone();
    } catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
    finally { setSubmitting(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()} data-testid="validate-handover-modal">
        <div className="font-serif text-xl mb-3">Valider le versement</div>
        <div className="p-3 rounded-lg bg-[#fff5f5] dark:bg-[#2a1818] text-xs mb-3">
          <div className="flex justify-between"><span className="text-[#666]">Déclaré par {session.handover_by}</span><span className="tabular font-semibold text-[#5867fd]">{fcfa(expected)}</span></div>
          <div className="flex justify-between text-[#666]"><span>Le</span><span>{dateTimeFmt(session.handover_at)}</span></div>
          {session.handover_note && <div className="mt-2 italic">"{session.handover_note}"</div>}
        </div>
        <label className="text-xs uppercase text-[#666] font-semibold">Montant effectivement reçu (FCFA)</label>
        <input type="number" min="0" inputMode="numeric" className="dina-input mt-1 mb-2 tabular text-right text-lg" value={actual} onChange={e => setActual(e.target.value)} data-testid="validate-actual" autoFocus/>
        <div className={`text-xs mb-3 font-semibold ${gap === 0 ? "text-[#1f8a4c]" : gap > 0 ? "text-[#1f8a4c]" : "text-[#c62828]"}`}>
          Écart : {gap > 0 ? "+" : ""}{fcfa(gap)} {gap !== 0 && "— ajouté au solde Gérante"}
        </div>
        <label className="text-xs uppercase text-[#666] font-semibold">Note (facultatif)</label>
        <textarea className="dina-input mt-1 mb-4" rows={2} placeholder="Ex. écart lié au change" value={note} onChange={e => setNote(e.target.value)} data-testid="validate-note"/>
        <div className="flex gap-2"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={submit} disabled={submitting} className="dina-btn-primary flex-1" data-testid="validate-confirm"><CheckCircle size={13}/>Valider</button></div>
      </div>
    </div>
  );
}
