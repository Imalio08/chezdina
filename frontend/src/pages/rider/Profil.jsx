import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { playChime, setSoundEnabled } from "@/lib/notifySound";
import { Camera, Phone, MessageCircle, AlertTriangle, Sun, Moon, Smartphone } from "lucide-react";

export default function Profil() {
  const { user, setUser } = useAuth();
  const [prefs, setPrefs] = useState({ theme: "light", wa: "whatsapp", sound: "on", ...(user?.prefs || {}) });

  useEffect(() => {
    try { const stored = JSON.parse(localStorage.getItem("rider_prefs") || "{}"); setPrefs(p => ({ ...p, ...stored })); } catch { }
  }, []);

  const update = async (patch) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    localStorage.setItem("rider_prefs", JSON.stringify(next));
    if (patch.sound) { setSoundEnabled(patch.sound === "on"); if (patch.sound === "on") playChime("notif", true); }
    if (patch.theme) {
      localStorage.setItem("rider_theme", patch.theme);
      document.documentElement.classList.toggle("dark", patch.theme === "dark" || (patch.theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches));
    }
    try { await api.patch("/users/me/prefs", next); } catch { }
  };

  const onPhoto = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try { await api.patch("/users/me/photo", { photo: reader.result }); setUser({ ...user, photo: reader.result }); toast.success("Photo mise à jour"); }
      catch { toast.error("Erreur"); }
    };
    reader.readAsDataURL(f);
  };

  const callManager = () => { window.location.href = "tel:+2250777926179"; };
  const waManager = () => { window.open("https://wa.me/2250777926179?text=Bonjour,%20c'est%20votre%20livreur%20Chez%20Dina", "_blank"); };
  const reportIssue = async () => {
    const kind = prompt("Type de problème (panne moto, accident, client agressif, colis endommagé) ?") || "autre";
    const details = prompt("Décrivez brièvement :") || "";
    if (!details) return;
    try { await api.post("/notifications", { kind: "alert", title: `Signalement livreur ${user.name} : ${kind}`, body: details }).catch(() => { }); toast.success("Gérante alertée"); }
    catch { toast.error("Erreur"); }
  };

  return (
    <div className="space-y-3">
      <div className="dina-card-white p-5 text-center">
        <div className="relative inline-block mb-3">
          {user?.photo ? <img src={user.photo} alt="" className="w-24 h-24 rounded-full object-cover mx-auto" /> :
            <div className="w-24 h-24 rounded-full bg-[#fde8e8] text-[#b02a2a] grid place-items-center font-serif text-3xl font-bold mx-auto">{user?.name?.[0] || "L"}</div>}
          <label className="absolute bottom-0 right-0 w-9 h-9 bg-[#b02a2a] rounded-full grid place-items-center text-white cursor-pointer shadow-lg" data-testid="profil-photo">
            <Camera size={14} />
            <input type="file" accept="image/*" capture="user" className="hidden" onChange={onPhoto} />
          </label>
        </div>
        <div className="font-serif text-xl">{user?.name}</div>
        <div className="text-xs text-[#666]">{user?.phone} · Livreur</div>
      </div>

      <div className="dina-card-white p-4">
        <div className="font-semibold text-sm mb-3">Préférences</div>
        <div className="mb-3">
          <div className="text-xs uppercase text-[#999] mb-1">Thème</div>
          <div className="grid grid-cols-3 gap-2">
            {[["light", Sun, "Clair"], ["dark", Moon, "Sombre"], ["auto", Smartphone, "Auto"]].map(([v, Ic, l]) => (
              <button key={v} onClick={() => update({ theme: v })} className={`py-2 rounded-lg border text-xs flex flex-col items-center gap-1 ${prefs.theme === v ? "bg-[#b02a2a] text-white border-[#b02a2a]" : "border-[#ececec] dark:border-[#2a2a2a]"}`} data-testid={`theme-${v}`}><Ic size={14} />{l}</button>
            ))}
          </div>
        </div>
        <div className="mb-3">
          <div className="text-xs uppercase text-[#999] mb-1">WhatsApp par défaut</div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => update({ wa: "whatsapp" })} className={`py-2 rounded-lg border text-xs ${prefs.wa === "whatsapp" ? "bg-[#b02a2a] text-white border-[#b02a2a]" : "border-[#ececec]"}`} data-testid="wa-standard">WhatsApp</button>
            <button onClick={() => update({ wa: "business" })} className={`py-2 rounded-lg border text-xs ${prefs.wa === "business" ? "bg-[#b02a2a] text-white border-[#b02a2a]" : "border-[#ececec]"}`} data-testid="wa-business">WhatsApp Business</button>
          </div>
        </div>
        <label className="flex items-center justify-between text-sm">
          <span>Son des notifications</span>
          <input type="checkbox" checked={prefs.sound === "on"} onChange={e => update({ sound: e.target.checked ? "on" : "off" })} className="accent-[#b02a2a]" data-testid="pref-sound" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={callManager} className="dina-btn-secondary !min-h-[48px] text-xs flex-col gap-0.5" data-testid="profil-call-manager"><Phone size={14} /><span>Appeler gérante</span></button>
        <button onClick={waManager} className="dina-btn-secondary !min-h-[48px] text-xs flex-col gap-0.5" data-testid="profil-wa-manager"><MessageCircle size={14} /><span>WhatsApp gérante</span></button>
      </div>
      <button onClick={reportIssue} className="dina-btn-primary w-full !min-h-[48px]" style={{ background: "#c62828" }} data-testid="profil-report"><AlertTriangle size={14} />Signaler un problème</button>
    </div>
  );
}
