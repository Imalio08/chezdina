import React, { useEffect, useState } from "react";
import { useFrontCamera } from "@/lib/useFrontCamera";
import { Camera, CheckCircle2, Loader2, LogOut, RotateCcw, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

// Full-screen mandatory arrival punch (selfie) for console staff subject to attendance.
export default function PunchGate() {
  const { user, setUser, logout } = useAuth();
  const cam = useFrontCamera();
  const camError = cam.error, ready = cam.ready;
  const [snapshot, setSnapshot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const start = () => { setSnapshot(null); cam.start(); };
  useEffect(() => { cam.start(); }, []); // eslint-disable-line

  const snap = () => {
    const img = cam.capture(); if (!img) return;
    setSnapshot(img); cam.stop();
  };

  const submit = async () => {
    setBusy(true); setError("");
    try {
      await api.post("/attendance/check-in", { kind: "arrival", method: "phone", selfie: snapshot });
      const { data } = await api.get("/auth/me");
      if (data.punch_required) throw new Error("not-saved");
      toast.success(`Arrivée pointée · bonne journée ${data.name?.split(" ")[0] || ""}`);
      setUser(data);
    } catch (e) {
      setError(e?.response?.data?.detail || "Le pointage n'a pas pu être enregistré. Vérifiez votre connexion et réessayez.");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-[#fff5f5] grid place-items-center p-4" data-testid="punch-gate">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-[#ececec] p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1"><Clock size={18} className="text-[#b02a2a]"/><h1 className="font-serif text-2xl">Pointer mon arrivée</h1></div>
        <p className="text-xs text-[#666] mb-4">Bonjour {user?.name}. Le pointage avec photo est obligatoire pour accéder à la console.</p>
        <div className="aspect-[4/3] bg-black rounded-xl overflow-hidden mb-3 relative">
          {snapshot
            ? <img src={snapshot} alt="Selfie" className="w-full h-full object-cover scale-x-[-1]" data-testid="punch-gate-snapshot"/>
            : <video ref={cam.videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" data-testid="punch-gate-video"/>}
          {camError && !snapshot && <div className="absolute inset-0 grid place-items-center p-4 text-center text-white text-xs bg-black/80" data-testid="punch-gate-cam-error"><div><AlertTriangle size={22} className="mx-auto mb-2 text-[#ffb3b3]"/>{camError}</div></div>}
        </div>
        {error && <div className="mb-3 p-2.5 rounded-lg bg-[#fde8e8] text-[#b02a2a] text-xs flex gap-2" data-testid="punch-gate-error"><AlertTriangle size={14} className="shrink-0 mt-0.5"/>{error}</div>}
        {!snapshot ? (
          camError
            ? <button onClick={start} className="dina-btn-primary w-full !min-h-[46px]" data-testid="punch-gate-retry-camera"><RotateCcw size={16}/>Réessayer</button>
            : <button onClick={snap} disabled={!ready} className="dina-btn-primary w-full !min-h-[46px]" data-testid="punch-gate-snap"><Camera size={16}/>{ready ? "Prendre la photo" : "Ouverture de la caméra…"}</button>
        ) : (
          <div className="space-y-2">
            <button onClick={submit} disabled={busy} className="dina-btn-primary w-full !min-h-[46px]" data-testid="punch-gate-submit">
              {busy ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>}{busy ? "Enregistrement…" : error ? "Réessayer le pointage" : "Pointer mon arrivée"}
            </button>
            <button onClick={start} disabled={busy} className="dina-btn-secondary w-full !min-h-[38px]" data-testid="punch-gate-retake"><RotateCcw size={14}/>Reprendre la photo</button>
          </div>
        )}
        <button onClick={logout} className="w-full mt-4 text-xs text-[#666] flex items-center justify-center gap-1" data-testid="punch-gate-logout"><LogOut size={12}/>Se déconnecter</button>
      </div>
    </div>
  );
}
