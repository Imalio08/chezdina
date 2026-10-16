import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { editImageFile } from "@/components/shared/ImageEditor";
import { playChime, setSoundEnabled } from "@/lib/notifySound";
import { Camera, Sun, Moon, Smartphone } from "lucide-react";
import SubPage from "@/components/rider/SubPage";

export default function Parametres() {
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
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    const ed = await editImageFile(f, { aspect: 1 }); if (!ed) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try { await api.patch("/users/me/photo", { photo: reader.result }); setUser({ ...user, photo: reader.result }); toast.success("Photo mise à jour"); }
      catch { toast.error("Photo non enregistrée · réessayez"); }
    };
    reader.readAsDataURL(ed);
  };
  const chip = (on) => `py-2 rounded-lg border text-xs ${on ? "bg-[#b02a2a] text-white border-[#b02a2a]" : "border-[#ececec] dark:border-[#2a2a2a]"}`;
  return (
    <SubPage title="Paramètres" testid="rider-parametres-page">
      <div className="dina-card-white p-4 flex items-center gap-3">
        {user?.photo ? <img src={user.photo} alt="" className="w-16 h-16 rounded-full object-cover"/> : <div className="w-16 h-16 rounded-full bg-[#fde8e8] text-[#b02a2a] grid place-items-center font-serif text-2xl font-bold">{user?.name?.[0] || "L"}</div>}
        <label className="dina-btn-secondary !min-h-[40px] text-xs cursor-pointer" data-testid="profil-photo"><Camera size={14}/>Changer ma photo<input type="file" accept="image/*" capture="user" className="hidden" onChange={onPhoto}/></label>
      </div>
      <div className="dina-card-white p-4 space-y-4">
        <div>
          <div className="text-xs uppercase text-[#999] mb-1">Thème</div>
          <div className="grid grid-cols-3 gap-2">
            {[["light", Sun, "Clair"], ["dark", Moon, "Sombre"], ["auto", Smartphone, "Auto"]].map(([v, Ic, l]) => (
              <button key={v} onClick={() => update({ theme: v })} className={`${chip(prefs.theme === v)} flex flex-col items-center gap-1`} data-testid={`theme-${v}`}><Ic size={14}/>{l}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase text-[#999] mb-1">WhatsApp par défaut</div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => update({ wa: "whatsapp" })} className={chip(prefs.wa === "whatsapp")} data-testid="wa-standard">WhatsApp</button>
            <button onClick={() => update({ wa: "business" })} className={chip(prefs.wa === "business")} data-testid="wa-business">WhatsApp Business</button>
          </div>
        </div>
        <label className="flex items-center justify-between text-sm">
          <span>Son des notifications</span>
          <input type="checkbox" checked={prefs.sound === "on"} onChange={e => update({ sound: e.target.checked ? "on" : "off" })} className="accent-[#b02a2a]" data-testid="pref-sound"/>
        </label>
      </div>
    </SubPage>
  );
}
