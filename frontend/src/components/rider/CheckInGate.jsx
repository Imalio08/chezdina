import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Camera, MapPin, CheckCircle2, Loader2, AlertTriangle, X } from "lucide-react";

/** Live selfie + GPS attendance gate for riders. Blocks all tabs until check-in. */
export default function CheckInGate({ user, onDone }) {
  const [stream, setStream] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [pos, setPos] = useState(null);
  const [geoErr, setGeoErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const videoRef = React.useRef(null);
  const canvasRef = React.useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        setStream(s);
        if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(()=>{}); }
      } catch { toast.error("Autorisez la caméra pour pointer"); }
    })();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => setPos({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
        err => setGeoErr(err.message),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      );
    }
    return () => { stream?.getTracks().forEach(t => t.stop()); }; // eslint-disable-line
  }, []); // eslint-disable-line

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
    if (!pos) return toast.error("Position GPS requise");
    setLoading(true);
    try {
      const { data } = await api.post("/attendance/check-in", {
        kind: "arrival", method: "phone", selfie: snapshot, lat: pos.lat, lng: pos.lng,
      });
      if (data.outside) toast.warning(`Pointage accepté hors boutique (${data.distance_m} m)`);
      else toast.success("Pointage enregistré");
      if (data.late) toast.info(`Retard de ${data.late_min} min noté`);
      onDone();
    } catch (e) { toast.error(e?.response?.data?.detail || "Erreur de pointage"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#fff5f5] dark:bg-[#0f0f0f] flex flex-col items-center justify-center p-5" data-testid="checkin-gate">
      <div className="w-full max-w-sm bg-white dark:bg-[#1a1a1a] border border-[#ececec] dark:border-[#2a2a2a] rounded-2xl p-5 shadow-xl">
        <div className="text-center mb-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#fde8e8] dark:bg-[#2a1818] text-[#b02a2a] grid place-items-center font-bold text-xl">{(user?.name||"L")[0]}</div>
          <div className="font-serif text-xl mt-2">Bonjour {user?.name?.split(" ")[0] || "Livreur"}</div>
          <div className="text-xs text-[#666]">Pour commencer, pointez votre arrivée</div>
        </div>

        <div className="aspect-[4/3] bg-black rounded-xl overflow-hidden relative mb-3">
          {!snapshot ? (
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover scale-x-[-1]" data-testid="checkin-video"/>
          ) : (
            <img src={snapshot} alt="selfie" className="w-full h-full object-cover scale-x-[-1]" data-testid="checkin-snapshot"/>
          )}
          <canvas ref={canvasRef} className="hidden"/>
        </div>

        {!snapshot ? (
          <button onClick={snap} disabled={!stream} className="dina-btn-primary w-full !min-h-[48px]" data-testid="checkin-snap">
            <Camera size={16}/>Prendre le selfie
          </button>
        ) : (
          <div className="space-y-2">
            <button onClick={retake} className="dina-btn-secondary w-full !min-h-[40px]" data-testid="checkin-retake"><X size={14}/>Reprendre</button>
            <div className="flex items-center gap-2 text-xs text-[#666] bg-[#fff5f5] dark:bg-[#2a1818] rounded-lg p-2.5" data-testid="checkin-gps">
              <MapPin size={13} className={pos?"text-[#1f8a4c]":"text-[#c62828]"}/>
              {pos ? <span>Position GPS captée · précision {Math.round(pos.acc)} m</span> : geoErr ? <span className="text-[#c62828]">GPS indisponible · {geoErr}</span> : <span>Capture GPS…</span>}
            </div>
            <button onClick={submit} disabled={!pos || loading} className="dina-btn-primary w-full !min-h-[48px]" data-testid="checkin-submit">
              {loading ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>}
              {loading ? "Envoi…" : "Pointer mon arrivée"}
            </button>
          </div>
        )}

        <div className="text-[11px] text-center text-[#999] mt-4"><AlertTriangle size={10} className="inline mr-1"/>Un selfie en direct et votre position sont requis pour valider la présence.</div>
      </div>
    </div>
  );
}
