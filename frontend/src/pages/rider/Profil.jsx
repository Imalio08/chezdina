import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { fcfa } from "@/lib/format";
import { History, Trophy, Star, Wallet, Phone, AlertTriangle, Settings, LogOut, ChevronRight, MessageCircle, Store, TrendingUp, TrendingDown, Minus, Clock } from "lucide-react";

const timeOf = (iso) => iso ? new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : null;
const DEFAULT_MANAGER = "+225 07 77 92 61 79";

function Row({ icon: Icon, label, sub, onClick, testid, danger }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-[#fff5f5] dark:active:bg-[#2a1818] border-b border-[#f0f0f0] dark:border-[#2a2a2a] last:border-0" data-testid={testid}>
      <span className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${danger ? "bg-[#fdecec] dark:bg-[#3a1515] text-[#c62828]" : "bg-[#fde8e8] dark:bg-[#2a1818] text-[#b02a2a]"}`}><Icon size={17}/></span>
      <span className="flex-1 min-w-0"><span className="block text-sm font-semibold">{label}</span>{sub && <span className="block text-[11px] text-[#666] truncate">{sub}</span>}</span>
      <ChevronRight size={16} className="text-[#bbb] shrink-0"/>
    </button>
  );
}

function SummaryCard({ score, today, onOpen }) {
  const t = score?.trend || 0;
  const Trend = t > 0 ? TrendingUp : t < 0 ? TrendingDown : Minus;
  const c = today?.counts || {};
  return (
    <button onClick={onOpen} className="w-full text-left rounded-2xl p-4 text-white shadow-md" style={{ background: "linear-gradient(150deg, #b02a2a 0%, #8e1f1f 60%, #4a1010 100%)" }} data-testid="profil-summary">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[#fde8e8]">Mon score</div>
          <div className="flex items-baseline gap-1"><span className="font-serif text-5xl tabular" data-testid="profil-score">{score?.score ?? "—"}</span><span className="text-sm text-white/70">/100</span></div>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-white/15 rounded-full px-2.5 py-1" data-testid="profil-trend"><Trend size={13}/>{t > 0 ? `+${t}` : t} cette semaine</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/20 text-center">
        <div><div className="font-serif text-xl tabular" data-testid="profil-livrees">{c.livrees ?? 0}</div><div className="text-[10px] text-[#fde8e8]">Livrées</div></div>
        <div><div className="font-serif text-xl tabular" data-testid="profil-a-livrer">{(c.a_livrer ?? 0) + (c.en_route ?? 0)}</div><div className="text-[10px] text-[#fde8e8]">À livrer</div></div>
        <div><div className="font-serif text-base tabular leading-7" data-testid="profil-collected">{fcfa(today?.collected || 0)}</div><div className="text-[10px] text-[#fde8e8]">Encaissé</div></div>
      </div>
      <div className="text-[11px] text-white/70 mt-3 flex items-center gap-1">Voir ma performance <ChevronRight size={12}/></div>
    </button>
  );
}

function ContactSheet({ phone, onClose, onStore }) {
  const digits = (phone || DEFAULT_MANAGER).replace(/\D/g, "");
  return (
    <div className="fixed inset-0 bg-black/60 z-[80] grid place-items-end" onClick={onClose} data-testid="profil-contact-sheet">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-t-2xl w-full p-4 pb-8 space-y-2" onClick={e => e.stopPropagation()}>
        <div className="font-semibold mb-1">Contacter la gérante <span className="text-xs font-normal text-[#666] tabular" data-testid="profil-manager-phone">· {phone || DEFAULT_MANAGER}</span></div>
        <button onClick={() => { window.location.href = `tel:+${digits}`; }} className="dina-btn-secondary w-full !min-h-[48px]" data-testid="profil-call-manager"><Phone size={15}/>Appeler</button>
        <button onClick={() => window.open(`https://wa.me/${digits}?text=Bonjour,%20c'est%20votre%20livreur%20Chez%20Dina`, "_blank")} className="dina-btn-secondary w-full !min-h-[48px] !text-[#1f8a4c]" data-testid="profil-wa-manager"><MessageCircle size={15}/>WhatsApp</button>
        <button onClick={onStore} className="dina-btn-primary w-full !min-h-[48px]" data-testid="profil-msg-manager"><Store size={15}/>Écrire dans l'app</button>
      </div>
    </div>
  );
}

export default function Profil() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [score, setScore] = useState(null);
  const [today, setToday] = useState(null);
  const [punch, setPunch] = useState(null);
  const [contact, setContact] = useState(false);
  const [managerPhone, setManagerPhone] = useState("");
  useEffect(() => { api.get("/public/rider-cms").then(r => setManagerPhone(r.data?.manager_phone || "")).catch(() => {}); }, []);
  useEffect(() => {
    if (!user) return;
    const loadPunch = () => api.get("/attendance/me").then(r => setPunch(r.data)).catch(() => {});
    api.get(`/riders/${user.id}/score`).then(r => setScore(r.data)).catch(() => {});
    api.get("/riders/me/today").then(r => setToday(r.data)).catch(() => {});
    loadPunch();
    window.addEventListener("rider-punch-changed", loadPunch);
    return () => window.removeEventListener("rider-punch-changed", loadPunch);
  }, [user]);
  const arrival = timeOf(punch?.arrival?.at || punch?.arrival?.time || (typeof punch?.arrival === "string" ? punch.arrival : null));
  const departure = timeOf(punch?.departure?.at || punch?.departure?.time || (typeof punch?.departure === "string" ? punch.departure : null));
  const writeStore = async () => {
    try { const r = await api.post("/rider/conversations/store"); nav(`/riders/messages/${r.data.id}`); }
    catch { toast.error("Impossible d'ouvrir la conversation · réessayez"); }
  };
  return (
    <div className="space-y-3" data-testid="rider-profil">
      <div className="flex items-center gap-3 px-1 pt-1" data-testid="profil-header">
        {user?.photo ? <img src={user.photo} alt="" className="w-16 h-16 rounded-full object-cover ring-2 ring-[#b02a2a]"/> :
          <div className="w-16 h-16 rounded-full bg-[#fde8e8] text-[#b02a2a] grid place-items-center font-serif text-2xl font-bold">{user?.name?.[0] || "L"}</div>}
        <div className="min-w-0">
          <div className="font-serif text-xl truncate">{user?.name}</div>
          <div className="text-xs text-[#666] flex items-center gap-1" data-testid="profil-checkin"><Clock size={11}/>{arrival ? `Arrivée pointée à ${arrival}${departure ? ` · départ ${departure}` : ""}` : "Pas encore pointé aujourd'hui"}</div>
        </div>
      </div>
      <SummaryCard score={score} today={today} onOpen={() => nav("/riders/performance")}/>
      <div className="dina-card-white !p-0 overflow-hidden" data-testid="profil-menu">
        <Row icon={History} label="Historique" sub="Mes journées et courses passées" onClick={() => nav("/riders/historique")} testid="profil-row-historique"/>
        <Row icon={Star} label="Revoir la visite guidée" sub="Les écrans principaux pas à pas" onClick={() => window.dispatchEvent(new Event("dina-replay-tour"))} testid="profil-row-tour"/>
        <Row icon={Trophy} label="Performance" sub={score ? `Niveau ${score.level}` : "Score et critères"} onClick={() => nav("/riders/performance")} testid="profil-row-performance"/>
        <Row icon={Star} label="Avis clients" sub={score ? (score.stats?.reviews ? `${score.stats.reviews} avis · ${score.stats.rating_avg}★` : "Aucun avis pour le moment") : null} onClick={() => nav("/riders/avis")} testid="profil-row-avis"/>
        <Row icon={Wallet} label="Mon solde" sub={today ? `À remettre : ${fcfa(today.balance_to_hand_over || 0)}` : null} onClick={() => nav("/riders/solde")} testid="profil-row-solde"/>
        <Row icon={Phone} label="Contacter la gérante" sub="Appel, WhatsApp ou message" onClick={() => setContact(true)} testid="profil-row-contact"/>
        <Row icon={AlertTriangle} label="Signaler un problème" sub="Panne, accident, client injoignable… et suivi" onClick={() => nav("/riders/signalements")} testid="profil-report" danger/>
        <Row icon={Settings} label="Paramètres" sub="Photo, nom, téléphone, thème" onClick={() => nav("/riders/parametres")} testid="profil-row-parametres"/>
        {punch?.checked_in && !punch?.departure && <Row icon={LogOut} label="Pointer mon départ" sub="Fin de journée" onClick={() => window.dispatchEvent(new Event("rider-open-punch"))} testid="profil-row-depart"/>}
      </div>
      {contact && <ContactSheet phone={managerPhone} onClose={() => setContact(false)} onStore={writeStore}/>}
    </div>
  );
}
