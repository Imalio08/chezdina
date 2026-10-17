import React, { useEffect, useState } from "react";
import { Camera, CheckCircle2, Loader2, X, LogIn, LogOut, RotateCcw, AlertTriangle } from "lucide-react";
import { useFrontCamera } from "@/lib/useFrontCamera";
import { toast } from "sonner";
import api from "@/lib/api";

/**
 * Simple selfie-only clock-in/out modal.
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - onDone?: (data) => void
 */
export default function AttendancePunchModal({ open, onClose, onDone }) {
  const [kind, setKind] = useState("arrival"); // arrival | departure
  const cam = useFrontCamera();
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      try {
        const r = await api.get("/attendance/me");
        if (active) {
          setStatus(r.data);
          // Default to departure if already checked in
          if (r.data?.checked_in && !r.data?.departure) setKind("departure");
          else setKind("arrival");
        }
      } catch {}
    })();
    setSnapshot(null);
    cam.start();
    return () => { active = false; cam.stop(); };
  }, [open]); // eslint-disable-line

  const snap = () => {
    const img = cam.capture();
    if (!img) return toast.error("La caméra n'est pas encore prête");
    setSnapshot(img); cam.stop();
  };

  const retake = () => { setSnapshot(null); cam.start(); };

  const submit = async () => {
    if (!snapshot) return toast.error("Prenez votre selfie");
    if (!/^\d{4,6}$/.test(pin)) return toast.error("Entrez votre PIN (4 à 6 chiffres)");
    setLoading(true);
    try {
      const { data } = await api.post("/attendance/check-in", { kind, method: "phone", selfie: snapshot, pin });
      toast.success(kind === "arrival" ? "Arrivée pointée" : "Départ pointé");
      if (data.late) toast.info(`Retard de ${data.late_min} min noté`);
      onDone && onDone(data);
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erreur de pointage");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const timeOf = (iso) => iso ? new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] grid place-items-center p-3" onClick={onClose} data-testid="punch-modal">
      <div className="w-full max-w-sm bg-white dark:bg-[#1a1a1a] rounded-2xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="font-serif text-xl">Pointage</div>
          <button onClick={onClose} className="text-[#999] hover:text-black dark:hover:text-white" data-testid="punch-close"><X size={18}/></button>
        </div>

        {status && (
          <div className="text-[11px] text-[#666] mb-3 flex gap-3">
            <span>Arrivée : <b className="text-[#1f8a4c]">{timeOf(status.arrival?.at) || "—"}</b></span>
            <span>Départ : <b className="text-[#b02a2a]">{timeOf(status.departure?.at) || "—"}</b></span>
          </div>
        )}

        <div className="flex gap-2 mb-3">
          <button onClick={() => setKind("arrival")} disabled={!!status?.arrival}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 ${kind === "arrival" ? "bg-[#1f8a4c] text-white" : "bg-[#f5f5f5] dark:bg-[#2a2a2a] text-[#666] dark:text-[#999]"} disabled:opacity-40`} data-testid="punch-arrival">
            <LogIn size={14}/>Arrivée
          </button>
          <button onClick={() => setKind("departure")} disabled={!status?.arrival || !!status?.departure}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 ${kind === "departure" ? "bg-[#b02a2a] text-white" : "bg-[#f5f5f5] dark:bg-[#2a2a2a] text-[#666] dark:text-[#999]"} disabled:opacity-40`} data-testid="punch-departure">
            <LogOut size={14}/>Départ
          </button>
        </div>

        <div className="aspect-[4/3] bg-black rounded-xl overflow-hidden relative mb-3">
          {!snapshot ? (
            <video ref={cam.videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" data-testid="punch-video"/>
          ) : (
            <img src={snapshot} alt="selfie" className="w-full h-full object-cover scale-x-[-1]" data-testid="punch-snapshot"/>
          )}
          {!snapshot && !cam.ready && !cam.error && <div className="absolute inset-0 grid place-items-center text-white/80 text-xs"><span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin"/>Ouverture de la caméra…</span></div>}
          {!snapshot && cam.error && <div className="absolute inset-0 grid place-items-center p-4 text-center text-white text-xs bg-black/85 overflow-y-auto" data-testid="punch-cam-error"><div><AlertTriangle size={22} className="mx-auto mb-2 text-[#ffb3b3]"/>{cam.error}</div></div>}
        </div>

        {!snapshot ? (
          cam.error
            ? <button onClick={cam.start} className="dina-btn-primary w-full !min-h-[46px]" data-testid="punch-retry-camera"><RotateCcw size={16}/>Réessayer</button>
            : <button onClick={snap} disabled={!cam.ready} className="dina-btn-primary w-full !min-h-[46px]" data-testid="punch-snap">
            <Camera size={16}/>{cam.ready ? "Prendre le selfie" : "Ouverture de la caméra…"}
          </button>
        ) : (
          <div className="space-y-2">
            <input
              type="password"
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="PIN (4 à 6 chiffres)"
              className="dina-input w-full text-center text-xl tracking-[0.4em] font-serif"
              data-testid="punch-pin"
              autoFocus
            />
            <button onClick={retake} className="dina-btn-secondary w-full !min-h-[38px]" data-testid="punch-retake">
              <RotateCcw size={14}/>Reprendre la photo
            </button>
            <button onClick={submit} disabled={loading} className="dina-btn-primary w-full !min-h-[46px]" data-testid="punch-submit">
              {loading ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>}
              {loading ? "Envoi…" : (kind === "arrival" ? "Pointer l'arrivée" : "Pointer le départ")}
            </button>
          </div>
        )}

        <div className="text-[10px] text-center text-[#999] mt-3">Selfie + PIN · votre identité est vérifiée des deux côtés.</div>
      </div>
    </div>
  );
}
