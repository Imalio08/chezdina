import React, { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { LogIn, LogOut, Fingerprint, Clock, ArrowLeft, Camera, CameraOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Kiosk() {
  const nav = useNavigate();
  const [pin, setPin] = useState("");
  const [kind, setKind] = useState("in");
  const [punches, setPunches] = useState([]);
  const [last, setLast] = useState(null);
  const [full, setFull] = useState(false);
  const [camActive, setCamActive] = useState(false);
  const [camError, setCamError] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const timerRef = useRef(null);

  const load = () => api.get("/attendance/today").then(r => setPunches(r.data || [])).catch(() => { });
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  // Start webcam when entering the page; stop on unmount.
  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 320, height: 240 }, audio: false });
        if (cancelled) { s.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = s;
        if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play().catch(()=>{}); }
        setCamActive(true); setCamError(null);
      } catch (e) {
        setCamError(e?.message || "Caméra indisponible");
        setCamActive(false);
      }
    };
    start();
    return () => {
      cancelled = true;
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    };
  }, []);

  const captureSelfie = () => {
    try {
      if (!videoRef.current || !camActive) return null;
      const v = videoRef.current;
      const c = canvasRef.current || document.createElement("canvas");
      c.width = 240; c.height = 180;
      const ctx = c.getContext("2d");
      ctx.drawImage(v, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.55);
    } catch { return null; }
  };

  const submit = async (code = pin) => {
    if (code.length < 4) return toast.error("PIN à 4 chiffres minimum");
    const selfie = captureSelfie();
    try {
      const r = await api.post("/attendance/punch-kiosk", { code, kind, selfie });
      setLast({ name: r.data.name, role: r.data.role, kind: r.data.kind, at: r.data.at, selfie });
      toast.success(`${kind === "in" ? "Arrivée" : "Départ"} enregistrée · ${r.data.name}${selfie ? " · Selfie capturé" : ""}`);
      setPin("");
      load();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setLast(null), 5000);
    } catch (e) { toast.error(e.response?.data?.detail || "Code invalide"); setPin(""); }
  };

  const digit = (d) => {
    const v = (pin + d).slice(0, 6);
    setPin(v);
    if (v.length === 4) submit(v);
  };

  return (
    <div className={full ? "fixed inset-0 bg-[#1c1c1c] z-[100] flex items-center justify-center p-4" : "min-h-[80vh] flex items-center justify-center"}>
      <div className={full ? "w-full max-w-md" : "w-full max-w-md dina-card-white p-6"}>
        <div className="flex justify-between items-center mb-4">
          {!full && <button onClick={() => nav(-1)} className="text-xs text-[#666] flex items-center gap-1"><ArrowLeft size={12} />Retour</button>}
          <button onClick={() => setFull(!full)} className={`text-xs ${full ? "text-white" : "text-[#b02a2a]"} font-semibold`} data-testid="kiosk-fullscreen">{full ? "Quitter plein écran" : "Mode kiosk (plein écran)"}</button>
        </div>
        <div className={`text-center mb-4 ${full ? "text-white" : ""}`}>
          <Fingerprint size={44} className="mx-auto mb-2 text-[#b02a2a]" />
          <div className="font-serif text-3xl">Pointage</div>
          <div className="text-xs opacity-70">Entrez votre code PIN à 4 chiffres</div>
        </div>

        <div className="relative mb-4 flex justify-center">
          <div className={`relative rounded-lg overflow-hidden border-2 ${camActive ? "border-[#1f8a4c]" : "border-[#c62828]"}`} style={{width:160, height:120}} data-testid="kiosk-cam">
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover bg-[#1c1c1c]" style={{transform:"scaleX(-1)"}}/>
            <canvas ref={canvasRef} className="hidden"/>
            {camActive ? (
              <div className="absolute bottom-1 left-1 right-1 flex items-center justify-center gap-1 text-[9px] text-white bg-[#1f8a4c]/90 rounded px-1 py-0.5"><Camera size={9}/>Selfie actif</div>
            ) : (
              <div className="absolute inset-0 bg-black/80 grid place-items-center text-white text-center p-2">
                <div>
                  <CameraOff size={20} className="mx-auto mb-1"/>
                  <div className="text-[9px]">Caméra indisponible</div>
                  <div className="text-[8px] opacity-70">Le pointage sera enregistré sans selfie</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <button onClick={() => setKind("in")} className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 ${kind === "in" ? "bg-[#1f8a4c] text-white" : full ? "bg-[#2a2a2a] text-[#999]" : "bg-[#f5f5f5] text-[#666]"}`} data-testid="kiosk-in"><LogIn size={16} />Arrivée</button>
          <button onClick={() => setKind("out")} className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 ${kind === "out" ? "bg-[#b02a2a] text-white" : full ? "bg-[#2a2a2a] text-[#999]" : "bg-[#f5f5f5] text-[#666]"}`} data-testid="kiosk-out"><LogOut size={16} />Départ</button>
        </div>

        <div className={`mb-3 text-center tracking-[0.5em] font-mono text-3xl ${full ? "text-white" : ""}`} data-testid="kiosk-pin-display">{pin.replace(/./g, "●").padEnd(4, "○")}</div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
            <button key={n} onClick={() => digit(String(n))} className={`py-5 rounded-lg text-2xl font-semibold ${full ? "bg-[#2a2a2a] text-white hover:bg-[#333]" : "bg-[#f5f5f5] hover:bg-[#ececec]"}`} data-testid={`kiosk-${n}`}>{n}</button>
          ))}
          <button onClick={() => setPin("")} className={`py-5 rounded-lg text-sm font-semibold ${full ? "bg-[#2a2a2a] text-white" : "bg-[#f5f5f5]"}`}>C</button>
          <button onClick={() => digit("0")} className={`py-5 rounded-lg text-2xl font-semibold ${full ? "bg-[#2a2a2a] text-white hover:bg-[#333]" : "bg-[#f5f5f5] hover:bg-[#ececec]"}`} data-testid="kiosk-0">0</button>
          <button onClick={() => setPin(pin.slice(0, -1))} className={`py-5 rounded-lg text-sm font-semibold ${full ? "bg-[#2a2a2a] text-white" : "bg-[#f5f5f5]"}`}>←</button>
        </div>

        {last && (
          <div className={`p-3 rounded-lg mb-4 flex gap-3 items-center ${last.kind === "in" ? "bg-[#f0f9f4] text-[#1f8a4c]" : "bg-[#fff5f5] text-[#b02a2a]"}`} data-testid="kiosk-last">
            {last.selfie && <img src={last.selfie} alt="" className="w-12 h-12 rounded-lg object-cover" style={{transform:"scaleX(-1)"}}/>}
            <div className="flex-1">
              <div className="text-xs uppercase font-semibold opacity-70">{last.kind === "in" ? "Arrivée enregistrée" : "Départ enregistré"}</div>
              <div className="font-serif text-lg">{last.name}</div>
              <div className="text-xs">{last.role} · {new Date(last.at).toLocaleTimeString("fr-FR")}</div>
            </div>
          </div>
        )}

        <div className={`text-xs ${full ? "text-[#999]" : "text-[#666]"} mt-2`}>
          <div className="flex items-center gap-1 mb-2 font-semibold uppercase"><Clock size={12} />Pointages aujourd'hui ({punches.length})</div>
          <div className="max-h-28 overflow-y-auto space-y-1">
            {punches.slice(0, 10).map(p => (
              <div key={p.id} className="flex justify-between" data-testid={`kiosk-punch-${p.id}`}>
                <span>{p.user_name} · <span className={p.kind === "in" ? "text-[#1f8a4c]" : "text-[#b02a2a]"}>{p.kind === "in" ? "Arrivée" : "Départ"}</span></span>
                <span className="tabular opacity-70">{new Date(p.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
