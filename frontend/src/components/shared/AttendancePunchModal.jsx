import React, { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, X, LogIn, LogOut, RotateCcw } from "lucide-react";
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
  const [stream, setStream] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // { checked_in, arrival, departure }
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

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
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 480, height: 360 }, audio: false });
        if (!active) { s.getTracks().forEach(t => t.stop()); return; }
        setStream(s);
        if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(() => {}); }
      } catch {
        toast.error("Autorisez la caméra pour pointer");
      }
    })();
    return () => { active = false; };
  }, [open]);

  // Stop the camera when the modal closes
  useEffect(() => {
    if (!open && stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); setSnapshot(null); }
  }, [open]); // eslint-disable-line

  const snap = () => {
    const v = videoRef.current; const c = canvasRef.current;
    if (!v || !c) return;
    c.width = 320; c.height = 240;
    c.getContext("2d").drawImage(v, 0, 0, 320, 240);
    setSnapshot(c.toDataURL("image/jpeg", 0.6));
    stream?.getTracks().forEach(t => t.stop()); setStream(null);
  };

  const retake = async () => {
    setSnapshot(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      setStream(s); if (videoRef.current) videoRef.current.srcObject = s;
    } catch {}
  };

  const submit = async () => {
    if (!snapshot) return toast.error("Prenez votre selfie");
    setLoading(true);
    try {
      const { data } = await api.post("/attendance/check-in", { kind, method: "phone", selfie: snapshot });
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
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover scale-x-[-1]" data-testid="punch-video"/>
          ) : (
            <img src={snapshot} alt="selfie" className="w-full h-full object-cover scale-x-[-1]" data-testid="punch-snapshot"/>
          )}
          <canvas ref={canvasRef} className="hidden"/>
        </div>

        {!snapshot ? (
          <button onClick={snap} disabled={!stream} className="dina-btn-primary w-full !min-h-[46px]" data-testid="punch-snap">
            <Camera size={16}/>Prendre le selfie
          </button>
        ) : (
          <div className="space-y-2">
            <button onClick={retake} className="dina-btn-secondary w-full !min-h-[38px]" data-testid="punch-retake">
              <RotateCcw size={14}/>Reprendre
            </button>
            <button onClick={submit} disabled={loading} className="dina-btn-primary w-full !min-h-[46px]" data-testid="punch-submit">
              {loading ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>}
              {loading ? "Envoi…" : (kind === "arrival" ? "Pointer l'arrivée" : "Pointer le départ")}
            </button>
          </div>
        )}

        <div className="text-[10px] text-center text-[#999] mt-3">Un selfie en direct suffit — pas besoin de GPS.</div>
      </div>
    </div>
  );
}
