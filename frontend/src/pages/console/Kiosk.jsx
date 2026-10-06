import React, { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { dateTimeFmt } from "@/lib/format";
import { toast } from "sonner";
import { LogIn, LogOut, Fingerprint, Clock, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Kiosk() {
  const nav = useNavigate();
  const [pin, setPin] = useState("");
  const [kind, setKind] = useState("in");
  const [punches, setPunches] = useState([]);
  const [last, setLast] = useState(null);
  const [full, setFull] = useState(false);
  const timerRef = useRef(null);

  const load = () => api.get("/attendance/today").then(r => setPunches(r.data)).catch(() => { });
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  const submit = async (code = pin) => {
    if (code.length < 4) return toast.error("PIN à 4 chiffres minimum");
    try {
      const r = await api.post("/attendance/punch-kiosk", { code, kind });
      setLast({ name: r.data.name, role: r.data.role, kind: r.data.kind, at: r.data.at });
      toast.success(`${kind === "in" ? "Arrivée" : "Départ"} enregistrée · ${r.data.name}`);
      setPin("");
      load();
      // auto-clear last after 5s
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
        <div className={`text-center mb-6 ${full ? "text-white" : ""}`}>
          <Fingerprint size={48} className="mx-auto mb-3 text-[#b02a2a]" />
          <div className="font-serif text-3xl">Pointage</div>
          <div className="text-sm opacity-70">Entrez votre code PIN à 4 chiffres</div>
        </div>

        <div className="flex gap-2 mb-5">
          <button onClick={() => setKind("in")} className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 ${kind === "in" ? "bg-[#1f8a4c] text-white" : full ? "bg-[#2a2a2a] text-[#999]" : "bg-[#f5f5f5] text-[#666]"}`} data-testid="kiosk-in"><LogIn size={16} />Arrivée</button>
          <button onClick={() => setKind("out")} className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 ${kind === "out" ? "bg-[#b02a2a] text-white" : full ? "bg-[#2a2a2a] text-[#999]" : "bg-[#f5f5f5] text-[#666]"}`} data-testid="kiosk-out"><LogOut size={16} />Départ</button>
        </div>

        <div className={`mb-4 text-center tracking-[0.5em] font-mono text-3xl ${full ? "text-white" : ""}`} data-testid="kiosk-pin-display">{pin.replace(/./g, "●").padEnd(4, "○")}</div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
            <button key={n} onClick={() => digit(String(n))} className={`py-5 rounded-lg text-2xl font-semibold ${full ? "bg-[#2a2a2a] text-white hover:bg-[#333]" : "bg-[#f5f5f5] hover:bg-[#ececec]"}`} data-testid={`kiosk-${n}`}>{n}</button>
          ))}
          <button onClick={() => setPin("")} className={`py-5 rounded-lg text-sm font-semibold ${full ? "bg-[#2a2a2a] text-white" : "bg-[#f5f5f5]"}`}>C</button>
          <button onClick={() => digit("0")} className={`py-5 rounded-lg text-2xl font-semibold ${full ? "bg-[#2a2a2a] text-white hover:bg-[#333]" : "bg-[#f5f5f5] hover:bg-[#ececec]"}`} data-testid="kiosk-0">0</button>
          <button onClick={() => setPin(pin.slice(0, -1))} className={`py-5 rounded-lg text-sm font-semibold ${full ? "bg-[#2a2a2a] text-white" : "bg-[#f5f5f5]"}`}>←</button>
        </div>

        {last && (
          <div className={`p-3 rounded-lg mb-4 text-center ${last.kind === "in" ? "bg-[#f0f9f4] text-[#1f8a4c]" : "bg-[#fff5f5] text-[#b02a2a]"}`} data-testid="kiosk-last">
            <div className="text-xs uppercase font-semibold opacity-70">{last.kind === "in" ? "Arrivée enregistrée" : "Départ enregistré"}</div>
            <div className="font-serif text-xl">{last.name}</div>
            <div className="text-xs">{last.role} · {new Date(last.at).toLocaleTimeString("fr-FR")}</div>
          </div>
        )}

        <div className={`text-xs ${full ? "text-[#999]" : "text-[#666]"} mt-2`}>
          <div className="flex items-center gap-1 mb-2 font-semibold uppercase"><Clock size={12} />Pointages aujourd'hui ({punches.length})</div>
          <div className="max-h-32 overflow-y-auto space-y-1">
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
