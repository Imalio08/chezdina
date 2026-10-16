import React, { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { fcfa, statusLabel, statusColor, payInfo } from "@/lib/format";
import { toast } from "sonner";
import { Phone, MapPin, Package, LogOut, History, Wallet, User, MessageCircle, Navigation, QrCode, AlertCircle, Clock, CheckCircle2, Truck } from "lucide-react";

const TABS = [
  { key: "courses", label: "Mes courses", icon: Package },
  { key: "historique", label: "Historique", icon: History },
  { key: "encaissements", label: "Encaissements", icon: Wallet },
  { key: "profil", label: "Profil", icon: User },
];

const CANCEL_REASONS = ["Cliente a refusé","Taille ne convient pas","Produit non conforme","Cliente injoignable","Adresse introuvable","Prix contesté","Commande en double"];
const WA_MANAGER_DEFAULT = "2250777926179";

export default function Rider() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState("courses");
  const [selected, setSelected] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [postponeOpen, setPostponeOpen] = useState(false);

  const load = () => api.get("/deliveries").then(r => setOrders(r.data));
  useEffect(() => { load(); }, []);
  const [managerWa, setManagerWa] = useState("");
  useEffect(() => { api.get("/public/rider-cms").then(r => setManagerWa((r.data?.manager_phone || "").replace(/\D/g, ""))).catch(() => {}); }, []);

  // Live GPS: push position every 30s if geolocation is granted
  useEffect(() => {
    if (!navigator.geolocation) return;
    let lastPush = 0;
    const push = (pos) => {
      const now = Date.now();
      if (now - lastPush < 20000) return; // throttle 20s
      lastPush = now;
      api.post("/riders/location", {
        lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy
      }).catch(() => {});
    };
    const watchId = navigator.geolocation.watchPosition(push, () => {}, { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const active = orders.filter(o => ["assignee","en_livraison","prete","recuperee"].includes(o.status));
  const history = orders.filter(o => ["livree","echouee","retournee","annulee"].includes(o.status));
  const delivered = history.filter(o => o.status === "livree");
  const toCollect = active.filter(o => o.payment_method === "cod").reduce((s,o)=>s+(o.total||0),0);
  const collected = delivered.filter(o => o.payment_method === "cod").reduce((s,o)=>s+(o.total||0),0);
  const remaining = toCollect; // not yet collected on active COD

  const update = async (status, extra = {}) => {
    try {
      await api.patch(`/orders/${selected.id}/status`, { status, ...extra });
      toast.success(statusLabel[status] || "Statut mis à jour");
      setSelected(null); setCancelOpen(false); setPostponeOpen(false);
      load();
    } catch { toast.error("Erreur"); }
  };

  const openMaps = () => {
    const q = selected.delivery_address || `${selected.delivery_zone || ""} Abidjan`;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}&travelmode=driving`, "_blank");
  };

  const alertManager = () => {
    const wa = managerWa || WA_MANAGER_DEFAULT;
    const msg = encodeURIComponent(`Bonjour, j'ai un souci sur la commande ${selected?.code || ""} : `);
    window.open(`https://wa.me/${wa}?text=${msg}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] max-w-md mx-auto flex flex-col">
      <header className="bg-[#1c1c1c] text-white p-4 flex items-center justify-between sticky top-0 z-20">
        <div><div className="font-serif text-xl">Chez Dina · Livreurs</div><div className="text-xs text-[#999]">{user?.name}</div></div>
        <div className="flex items-center gap-2">
          <button onClick={alertManager} className="bg-[#b02a2a] px-2 py-1 rounded text-[11px] flex items-center gap-1" data-testid="rider-contact-manager" title="Contacter la gérante"><MessageCircle size={11}/>Gérante</button>
          <button onClick={async()=>{await logout(); nav("/riders/connexion");}} className="text-[#999]" data-testid="rider-logout"><LogOut size={18}/></button>
        </div>
      </header>

      {tab === "courses" && (
        <div className="bg-white border-b border-[#ececec] px-4 py-3 grid grid-cols-3 gap-2 text-center">
          <div><div className="text-[9px] uppercase text-[#666]">À livrer</div><div className="font-serif text-xl tabular text-[#b02a2a]">{active.length}</div></div>
          <div><div className="text-[9px] uppercase text-[#666]">Livrées</div><div className="font-serif text-xl tabular text-[#1f8a4c]">{delivered.length}</div></div>
          <div><div className="text-[9px] uppercase text-[#666]">Collecté</div><div className="font-serif text-xl tabular">{fcfa(collected)}</div></div>
        </div>
      )}

      <main className="flex-1 pb-20 p-4 space-y-3">
        {tab === "courses" && (active.length ? active.map(o => (
          <div key={o.id} onClick={()=>setSelected(o)} className="bg-white border border-[#ececec] rounded-xl p-4 shadow-sm active:scale-[0.99] transition" data-testid={`rider-course-${o.code}`}>
            <div className="flex justify-between items-start mb-1"><div className="font-semibold text-sm">{o.code}</div><span className="dina-chip" style={{color:statusColor[o.status]}}><span className="status-dot" style={{background:statusColor[o.status]}}/>{statusLabel[o.status]}</span></div>
            <div className="text-sm font-medium">{o.customer?.name}</div>
            <div className="text-xs text-[#666] flex items-center gap-1 mt-1"><MapPin size={11}/>{o.delivery_zone}{o.delivery_address?` · ${o.delivery_address.slice(0,40)}`:""}</div>
            <div className="flex justify-between items-end mt-3">
              <div className="text-xs text-[#666]">{(o.items || []).length} article(s) · {o.payment_method==="cod"?<strong className="text-[#c62828]">À encaisser {fcfa(o.total)}</strong>:<strong style={{ color: payInfo(o).color }}>{payInfo(o).paid ? "Déjà payé" : payInfo(o).label}</strong>}</div>
              <div className="tabular font-semibold text-sm">{fcfa(o.total)}</div>
            </div>
          </div>
        )) : <div className="text-center text-sm text-[#666] py-10">Aucune course active · bonne journée !</div>)}

        {tab === "historique" && (history.length ? history.map(o => (
          <div key={o.id} className="bg-white border border-[#ececec] rounded-xl p-3">
            <div className="flex justify-between items-center"><div className="font-medium text-sm">{o.code}</div><span className="dina-chip" style={{color:statusColor[o.status]}}><span className="status-dot" style={{background:statusColor[o.status]}}/>{statusLabel[o.status]}</span></div>
            <div className="text-xs text-[#666] mt-1">{o.customer?.name} · {o.delivery_zone}</div>
            <div className="flex justify-between mt-1"><div className="tabular text-sm font-semibold">{fcfa(o.total)}</div>{o.reason && <div className="text-[10px] text-[#c62828] italic">« {o.reason} »</div>}</div>
          </div>
        )) : <div className="text-center text-sm text-[#666] py-10">Historique vide</div>)}

        {tab === "encaissements" && (
          <div className="space-y-3">
            <div className="bg-white border border-[#ececec] rounded-xl p-4"><div className="text-xs uppercase text-[#666] mb-1">Collecté aujourd'hui</div><div className="font-serif text-3xl tabular text-[#1f8a4c]">{fcfa(collected)}</div><div className="text-xs text-[#666] mt-1">{delivered.filter(o=>o.payment_method==="cod").length} livraison(s) en paiement livraison</div></div>
            <div className="bg-white border border-[#ececec] rounded-xl p-4"><div className="text-xs uppercase text-[#666] mb-1">Reste à encaisser</div><div className="font-serif text-3xl tabular text-[#b02a2a]">{fcfa(remaining)}</div><div className="text-xs text-[#666] mt-1">{active.filter(o=>o.payment_method==="cod").length} commande(s) en cours</div></div>
            <div className="text-xs uppercase text-[#666] font-semibold mt-4">Détail des livraisons payées</div>
            {delivered.filter(o=>o.payment_method==="cod").map(o => (
              <div key={o.id} className="bg-white border border-[#ececec] rounded-xl p-3 flex justify-between items-center"><div><div className="text-sm font-medium">{o.code}</div><div className="text-xs text-[#666]">{o.customer?.name}</div></div><div className="tabular font-semibold text-[#1f8a4c]">+{fcfa(o.total)}</div></div>
            ))}
          </div>
        )}

        {tab === "profil" && user && (
          <div className="bg-white border border-[#ececec] rounded-xl p-5 space-y-3">
            <div className="w-20 h-20 rounded-full bg-[#b02a2a] text-white grid place-items-center font-serif text-3xl mx-auto">{user.name?.[0]}</div>
            <div className="text-center"><div className="font-semibold text-lg">{user.name}</div><div className="text-xs text-[#666] capitalize">{user.role}</div><div className="text-sm text-[#666]">{user.phone}</div></div>
            <div className="pt-3 border-t border-[#ececec] space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[#666]">Livraisons du jour</span><strong>{delivered.length}</strong></div>
              <div className="flex justify-between"><span className="text-[#666]">Taux de réussite</span><strong className="text-[#1f8a4c]">{history.length?Math.round(delivered.length/history.length*100):0}%</strong></div>
              <div className="flex justify-between"><span className="text-[#666]">À encaisser restant</span><strong className="text-[#b02a2a] tabular">{fcfa(remaining)}</strong></div>
            </div>
            <button onClick={alertManager} className="dina-btn-secondary w-full"><AlertCircle size={14}/>Signaler un problème</button>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-[#ececec] max-w-md mx-auto grid grid-cols-4 h-16">
        {TABS.map(({key, label, icon:Icon}) => (
          <button key={key} onClick={()=>setTab(key)} className={`flex flex-col items-center justify-center text-[11px] ${tab===key?"text-[#b02a2a] font-semibold":"text-[#666]"}`} data-testid={`rider-tab-${key}`}><Icon size={18}/>{label.split(" ")[0]}</button>
        ))}
      </nav>

      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={()=>setSelected(null)}>
          <div className="bg-white w-full rounded-t-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="w-10 h-1 bg-[#ececec] rounded-full mx-auto mb-4"/>
            <div className="font-semibold text-lg">{selected.code}</div>
            <div className="text-sm text-[#666] mb-1">{selected.customer?.name}</div>
            <div className="text-xs text-[#666] mb-4 flex items-center gap-1"><MapPin size={11}/>{selected.delivery_zone}{selected.delivery_address?` · ${selected.delivery_address}`:""}</div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <a href={`tel:${selected.customer?.phone}`} className="dina-btn-secondary !min-h-[52px] flex-col text-[11px]" data-testid="rider-call"><Phone size={16}/>Appeler</a>
              <a href={`https://wa.me/${(selected.customer?.phone||"").replace(/\D/g,"")}`} target="_blank" rel="noreferrer" className="dina-btn-secondary !min-h-[52px] flex-col text-[11px]" style={{background:"#1f8a4c",color:"white",borderColor:"#1f8a4c"}} data-testid="rider-whatsapp"><MessageCircle size={16}/>WhatsApp</a>
              <button onClick={openMaps} className="dina-btn-secondary !min-h-[52px] flex-col text-[11px]" style={{background:"#0021cc",color:"white",borderColor:"#0021cc"}} data-testid="rider-maps"><Navigation size={16}/>Itinéraire</button>
            </div>

            <div className="space-y-1 mb-4">
              <div className="text-[10px] uppercase text-[#666] font-semibold">Articles</div>
              {selected.items.map((it,i)=>(
                <div key={i} className="flex justify-between text-sm"><span>{it.qty}× {it.name}{it.size?` · ${it.size}`:""}{it.color?` · ${it.color}`:""}</span><span className="tabular">{fcfa(it.qty*it.price)}</span></div>
              ))}
            </div>

            {selected.delivery_fee>0 && <div className="flex justify-between text-sm text-[#666] mb-1"><span>Livraison</span><span className="tabular">{fcfa(selected.delivery_fee)}</span></div>}
            <div className="flex justify-between font-semibold text-base mb-4 pt-2 border-t"><span>{selected.payment_method==="cod"?"À encaisser":"Déjà payé"}</span><span className="tabular" style={{color:selected.payment_method==="cod"?"#b02a2a":"#1f8a4c"}}>{selected.payment_method==="cod"?fcfa(selected.total):fcfa(selected.total)}</span></div>

            {selected.notes && <div className="text-xs italic text-[#666] bg-[#fff5f5] p-2 rounded mb-3">« {selected.notes} »</div>}

            <div className="grid grid-cols-2 gap-2">
              {selected.status === "assignee" && <button onClick={()=>update("recuperee")} className="dina-btn-secondary col-span-2" style={{background:"#5867fd",color:"white",borderColor:"#5867fd"}} data-testid="rider-pickup"><Package size={14}/>Récupérée (colis en main)</button>}
              {["assignee","recuperee"].includes(selected.status) && <button onClick={()=>update("en_livraison")} className="dina-btn-primary col-span-2" data-testid="rider-start"><Truck size={14}/>En route vers la cliente</button>}
              <button onClick={()=>update("livree")} className="dina-btn-primary" style={{background:"#1f8a4c",borderColor:"#1f8a4c"}} data-testid="rider-delivered"><CheckCircle2 size={14}/>Livrée</button>
              <button onClick={()=>setPostponeOpen(true)} className="dina-btn-secondary" style={{background:"#e4991e",color:"white",borderColor:"#e4991e"}} data-testid="rider-postpone"><Clock size={14}/>Reportée</button>
              <button onClick={()=>setCancelOpen(true)} className="dina-btn-secondary col-span-2" style={{background:"#c62828",color:"white",borderColor:"#c62828"}} data-testid="rider-cancel"><AlertCircle size={14}/>Annulée / Échec</button>
            </div>

            {cancelOpen && <CancelSheet onClose={()=>setCancelOpen(false)} onConfirm={(reason)=>update("annulee",{reason})}/>}
            {postponeOpen && <PostponeSheet onClose={()=>setPostponeOpen(false)} onConfirm={(date,reason)=>update("confirmee",{next_date:date,reason:reason||"Reportée"})}/>}
          </div>
        </div>
      )}
    </div>
  );
}

function CancelSheet({ onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-end" onClick={onClose}>
      <div className="bg-white w-full rounded-t-2xl p-5" onClick={e=>e.stopPropagation()}>
        <div className="font-serif text-lg mb-3">Motif d'annulation / échec</div>
        <div className="space-y-1.5 mb-3">
          {CANCEL_REASONS.map(r => <button key={r} onClick={()=>setReason(r)} className={`w-full text-left p-2.5 rounded-lg border text-sm ${reason===r?"bg-[#fff5f5] border-[#b02a2a]":"border-[#ececec]"}`} data-testid={`cancel-${r.slice(0,10)}`}>{r}</button>)}
        </div>
        <textarea className="dina-input mb-3" rows={2} placeholder="Commentaire (optionnel)" value={note} onChange={e=>setNote(e.target.value)}/>
        <div className="flex gap-2"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button disabled={!reason} onClick={()=>onConfirm(`${reason}${note?` · ${note}`:""}`)} className="dina-btn-primary flex-1" style={{background:"#c62828",borderColor:"#c62828"}} data-testid="cancel-confirm">Confirmer</button></div>
      </div>
    </div>
  );
}

function PostponeSheet({ onClose, onConfirm }) {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
  const [date, setDate] = useState(tomorrow.toISOString().slice(0,10));
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-end" onClick={onClose}>
      <div className="bg-white w-full rounded-t-2xl p-5" onClick={e=>e.stopPropagation()}>
        <div className="font-serif text-lg mb-3">Reporter la livraison</div>
        <label className="text-xs uppercase text-[#666] font-semibold">Nouvelle date</label>
        <input type="date" className="dina-input mb-3" value={date} onChange={e=>setDate(e.target.value)} data-testid="postpone-date"/>
        <label className="text-xs uppercase text-[#666] font-semibold">Motif</label>
        <input className="dina-input mb-3" placeholder="Ex. cliente absente, demande report…" value={reason} onChange={e=>setReason(e.target.value)}/>
        <div className="flex gap-2"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={()=>onConfirm(date,reason)} className="dina-btn-primary flex-1" style={{background:"#e4991e",borderColor:"#e4991e"}} data-testid="postpone-confirm">Confirmer</button></div>
      </div>
    </div>
  );
}
