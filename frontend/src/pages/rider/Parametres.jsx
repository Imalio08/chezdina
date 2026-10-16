import React, { useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { editImageFile } from "@/components/shared/ImageEditor";
import { Camera, Sun, Moon, Smartphone, Save } from "lucide-react";
import SubPage from "@/components/rider/SubPage";

function InfoForm({ user, setUser }) {
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { const r = await api.patch("/users/me/profile", { name, phone }); setUser({ ...user, name: r.data.name, phone: r.data.phone }); toast.success("Informations enregistrées"); }
    catch (e) { toast.error(e.response?.data?.detail || "Enregistrement impossible · réessayez"); }
    finally { setBusy(false); }
  };
  const changed = name !== (user?.name || "") || phone !== (user?.phone || "");
  return (
    <div className="dina-card-white p-4 space-y-2" data-testid="rider-info-form">
      <div className="text-xs uppercase text-[#999]">Mes informations</div>
      <input className="dina-input" placeholder="Nom complet" value={name} onChange={e => setName(e.target.value)} data-testid="rider-info-name"/>
      <input className="dina-input tabular" type="tel" placeholder="+225 07 00 00 00 00" value={phone} onChange={e => setPhone(e.target.value)} data-testid="rider-info-phone"/>
      <button onClick={save} disabled={busy || !changed} className="dina-btn-primary w-full !min-h-[44px] disabled:opacity-50" data-testid="rider-info-save"><Save size={14}/>{busy ? "Enregistrement…" : "Enregistrer"}</button>
    </div>
  );
}

export default function Parametres() {
  const { user, setUser } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem("rider_theme") || user?.prefs?.theme || "light");
  const pickTheme = async (t) => {
    setTheme(t);
    localStorage.setItem("rider_theme", t);
    document.documentElement.classList.toggle("dark", t === "dark" || (t === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches));
    try { await api.patch("/users/me/prefs", { ...(user?.prefs || {}), theme: t }); } catch { }
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
  return (
    <SubPage title="Paramètres" testid="rider-parametres-page">
      <div className="dina-card-white p-4 flex items-center gap-3">
        {user?.photo ? <img src={user.photo} alt="" className="w-16 h-16 rounded-full object-cover"/> : <div className="w-16 h-16 rounded-full bg-[#fde8e8] text-[#b02a2a] grid place-items-center font-serif text-2xl font-bold">{user?.name?.[0] || "L"}</div>}
        <label className="dina-btn-secondary !min-h-[40px] text-xs cursor-pointer" data-testid="profil-photo"><Camera size={14}/>Changer ma photo<input type="file" accept="image/*" capture="user" className="hidden" onChange={onPhoto}/></label>
      </div>
      <InfoForm user={user} setUser={setUser}/>
      <div className="dina-card-white p-4">
        <div className="text-xs uppercase text-[#999] mb-1">Thème</div>
        <div className="grid grid-cols-3 gap-2">
          {[["light", Sun, "Clair"], ["dark", Moon, "Sombre"], ["auto", Smartphone, "Auto"]].map(([v, Ic, l]) => (
            <button key={v} onClick={() => pickTheme(v)} className={`py-2 rounded-lg border text-xs flex flex-col items-center gap-1 ${theme === v ? "bg-[#b02a2a] text-white border-[#b02a2a]" : "border-[#ececec] dark:border-[#2a2a2a]"}`} data-testid={`theme-${v}`}><Ic size={14}/>{l}</button>
          ))}
        </div>
      </div>
    </SubPage>
  );
}
