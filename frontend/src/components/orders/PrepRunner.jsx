import React, { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { fcfa, dateTimeFmt } from "@/lib/format";
import { toast } from "sonner";
import { Check, Package, ScanLine, AlertTriangle, ArrowLeft, Keyboard, Printer, Camera, XCircle } from "lucide-react";
import { downloadPackingSlipPDF, fetchBusinessForPdf } from "@/lib/pdfInvoice";

const slip = async (o) => downloadPackingSlipPDF(o, await fetchBusinessForPdf(api));

function CameraScanner({ onCode }) {
  const ref = useRef(null);
  const last = useRef({ code: "", at: 0 });
  const [err, setErr] = useState("");
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!alive) return;
        const s = new Html5Qrcode("prep-camera", { verbose: false });
        ref.current = s;
        await s.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 240, height: 160 } }, (text) => {
          const now = Date.now();
          if (text === last.current.code && now - last.current.at < 2500) return;
          last.current = { code: text, at: now };
          onCode(text);
        }, () => {});
      } catch { if (alive) setErr("Caméra indisponible ou refusée · autorisez la caméra ou tapez le code de l'étiquette."); }
    })();
    return () => { alive = false; const s = ref.current; if (s) s.stop().then(() => s.clear()).catch(() => {}); };
  }, [onCode]);
  return (
    <div className="rounded-xl overflow-hidden bg-black relative" data-testid="prep-camera-wrap">
      <div id="prep-camera" className="w-full min-h-[220px]" />
      {err && <div className="absolute inset-0 grid place-items-center p-4 text-center text-white text-xs bg-black/85" data-testid="prep-camera-error">{err}</div>}
    </div>
  );
}

function Line({ l }) {
  const ok = l.done >= l.qty;
  return (
    <div className={`dina-card-white p-3 transition ${ok ? "border-l-4 !border-l-[#1f8a4c] bg-[#f0f9f4]" : ""}`} data-testid={`prep-line-${l.line_index}`}>
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-lg bg-[#fff5f5] overflow-hidden shrink-0">{l.item.image && <img src={l.item.image} alt="" className="w-full h-full object-cover"/>}</div>
        <div className="flex-1 min-w-0">
          <div className="font-serif text-base break-words">{l.item.name}</div>
          <div className="text-xs text-[#666] flex flex-wrap gap-x-2">
            {l.item.size && <span>Taille <b>{l.item.size}</b></span>}
            {l.item.color && <span>Couleur <b>{l.item.color}</b></span>}
            <span>Qté <b>{l.qty}</b></span>
          </div>
          <div className="text-xs mt-0.5">Code attendu : <span className="font-mono font-semibold" data-testid={`prep-line-expected-${l.line_index}`}>{l.expected_code}</span></div>
        </div>
        <div className="shrink-0 text-right">
          {ok ? <div className="w-10 h-10 rounded-full bg-[#1f8a4c] text-white grid place-items-center ml-auto" data-testid={`prep-line-ok-${l.line_index}`}><Check size={18}/></div>
            : <div className="text-xs font-semibold text-[#999]" data-testid={`prep-line-count-${l.line_index}`}>{l.done}/{l.qty}</div>}
        </div>
      </div>
    </div>
  );
}

function PrepLog({ log }) {
  if (!log.length) return null;
  return (
    <div className="dina-card-white p-4" data-testid="prep-log">
      <div className="text-xs uppercase font-semibold text-[#666] mb-2">Journal des vérifications</div>
      <div className="space-y-1 max-h-56 overflow-y-auto">
        {[...log].reverse().map(c => (
          <div key={c.id} className="text-xs flex gap-2 items-start" data-testid={`prep-log-${c.id}`}>
            {c.ok ? <Check size={12} className="text-[#1f8a4c] mt-0.5 shrink-0"/> : <XCircle size={12} className="text-[#c62828] mt-0.5 shrink-0"/>}
            <span className="text-[#999] tabular shrink-0">{dateTimeFmt(c.at)}</span>
            <span className="min-w-0 break-words">{c.method === "scan" ? "Scan" : "Code tapé"} <span className="font-mono">{c.code}</span> · {c.by} · <span className={c.ok ? "text-[#1f8a4c]" : "text-[#c62828]"}>{c.message}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Preparation: every item must be verified with its label code (camera scan or typed) before "Prête". */
export default function PrepRunner({ order, onBack }) {
  const [lines, setLines] = useState([]);
  const [log, setLog] = useState([]);
  const [mode, setMode] = useState("scan");
  const [typed, setTyped] = useState("");
  const [refusal, setRefusal] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const busyRef = useRef(false);
  useEffect(() => { api.get(`/orders/${order.id}/prep`).then(r => { setLines(r.data.lines); setLog(r.data.log); }).catch(() => toast.error("Préparation indisponible")); }, [order.id]);

  const verify = useCallback(async (raw, method) => {
    const code = (raw || "").trim();
    if (!code || busyRef.current) return;
    busyRef.current = true;
    try {
      const { data } = await api.post(`/orders/${order.id}/prep/verify`, { code, method });
      setLines(data.lines); setLog(l => [...l, data.entry]);
      if (data.ok) { setRefusal(""); toast.success(data.message); } else { setRefusal(data.message); toast.error(data.message); }
    } catch (e) { toast.error(e?.response?.data?.detail || "Vérification impossible"); }
    finally { busyRef.current = false; }
  }, [order.id]);
  const onCamera = useCallback((c) => verify(c, "scan"), [verify]);

  const allDone = lines.length > 0 && lines.every(l => l.done >= l.qty);
  const doneCount = lines.filter(l => l.done >= l.qty).length;
  const markReady = async () => {
    setBusy(true);
    try { await api.patch(`/orders/${order.id}/status-v3`, { status: "prete" }); setReady(true); toast.success("Commande prête ✓"); }
    catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4" data-testid="prep-runner">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button onClick={onBack} className="text-sm text-[#666] inline-flex items-center gap-1 hover:text-[#b02a2a]" data-testid="prep-back"><ArrowLeft size={14}/>Retour</button>
        <div className="text-xs text-[#666]" data-testid="prep-progress"><b className="text-[#1c1c1c] dark:text-white">{doneCount}</b> / {lines.length} articles vérifiés</div>
      </div>
      <div className="dina-card-white p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div><div className="font-mono text-xs text-[#666]">{order.code}</div><div className="font-serif text-2xl">{order.customer?.name || "—"}</div></div>
          <div className="font-serif text-2xl tabular text-[#b02a2a]">{fcfa(order.total)}</div>
        </div>
        {!ready && !allDone && <>
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#f5f5f5] dark:bg-[#141414] rounded-lg">
            <button onClick={() => setMode("scan")} className={`py-2 rounded-md text-sm inline-flex items-center justify-center gap-1 ${mode === "scan" ? "bg-white dark:bg-[#2a2a2a] shadow font-semibold" : "text-[#666]"}`} data-testid="prep-mode-scan"><Camera size={14}/>Scanner</button>
            <button onClick={() => setMode("saisie")} className={`py-2 rounded-md text-sm inline-flex items-center justify-center gap-1 ${mode === "saisie" ? "bg-white dark:bg-[#2a2a2a] shadow font-semibold" : "text-[#666]"}`} data-testid="prep-mode-type"><Keyboard size={14}/>Taper le code</button>
          </div>
          {mode === "scan" ? <CameraScanner onCode={onCamera}/> : (
            <form onSubmit={e => { e.preventDefault(); verify(typed, "saisie"); setTyped(""); }} className="flex gap-2">
              <input autoFocus value={typed} onChange={e => setTyped(e.target.value)} placeholder="Code imprimé sur l'étiquette" className="dina-input flex-1 font-mono uppercase" data-testid="prep-code-input"/>
              <button className="dina-btn-primary" data-testid="prep-code-submit"><ScanLine size={14}/>Vérifier</button>
            </form>
          )}
          {refusal && <div className="p-2.5 rounded-lg bg-[#fde8e8] text-[#c62828] text-sm font-semibold flex gap-2" data-testid="prep-refusal"><AlertTriangle size={16} className="shrink-0"/>{refusal}</div>}
        </>}
      </div>
      <div className="space-y-2">{lines.map(l => <Line key={l.line_index} l={l}/>)}</div>
      <PrepLog log={log}/>
      <div className="sticky bottom-0 bg-white dark:bg-[#1a1a1a] p-3 border-t border-[#ececec] dark:border-[#2a2a2a] -mx-3 sm:-mx-4 space-y-2">
        {!allDone && <div className="text-xs text-[#666] flex items-center gap-1"><AlertTriangle size={12} className="text-[#e4991e]"/>Chaque article doit être vérifié avec son code ({lines.length - doneCount} restant{lines.length - doneCount > 1 ? "s" : ""})</div>}
        <div className="flex gap-2">
          {!ready && <button onClick={markReady} disabled={!allDone || busy} className="dina-btn-primary flex-1 !min-h-[48px]" data-testid="prep-mark-ready"><Package size={16}/>{busy ? "Enregistrement…" : "Marquer comme prête"}</button>}
          <button onClick={() => slip(order).catch(() => toast.error("Impression impossible"))} disabled={!allDone} className={`${ready ? "dina-btn-primary" : "dina-btn-secondary"} flex-1 !min-h-[48px] disabled:opacity-40 disabled:cursor-not-allowed`} data-testid="prep-print-slip"><Printer size={16}/>Imprimer la fiche colis</button>
          {ready && <button onClick={onBack} className="dina-btn-secondary !min-h-[48px]" data-testid="prep-done-back">Terminer</button>}
        </div>
      </div>
    </div>
  );
}
