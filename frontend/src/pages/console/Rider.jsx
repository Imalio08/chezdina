import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { fcfa, statusLabel, statusColor } from "@/lib/format";
import { toast } from "sonner";
import { Phone, MapPin, Package, LogOut, History, Wallet, User, MessageCircle, Navigation } from "lucide-react";

const TABS = [
  { key: "courses", label: "Mes courses", icon: Package },
  { key: "historique", label: "Historique", icon: History },
  { key: "encaissements", label: "Encaissements", icon: Wallet },
  { key: "profil", label: "Profil", icon: User },
];

export default function Rider() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState("courses");
  const [selected, setSelected] = useState(null);
  const load = ()=>api.get("/deliveries").then(r=>setOrders(r.data));
  useEffect(load,[]);
  const update = async (status) => {await api.patch(`/orders/${selected.id}/status`,{status});toast.success(statusLabel[status]);setSelected(null);load();};
  const active = orders.filter(o=>["assignee","en_livraison","prete"].includes(o.status));
  const history = orders.filter(o=>["livree","echouee","retournee"].includes(o.status));
  const cash = history.filter(o=>o.payment_method==="cod" && o.status==="livree").reduce((s,o)=>s+o.total,0);

  return (
    <div className="min-h-screen bg-[#f5f5f5] max-w-md mx-auto flex flex-col">
      <header className="bg-[#1c1c1c] text-white p-4 flex items-center justify-between sticky top-0 z-20">
        <div><div className="font-serif text-xl">Dina Livraison</div><div className="text-xs text-[#999]">{user?.name}</div></div>
        <button onClick={async()=>{await logout();nav("/login");}} className="text-[#999]" data-testid="rider-logout"><LogOut size={18}/></button>
      </header>
      <main className="flex-1 pb-20 p-4 space-y-3">
        {tab==="courses" && (active.length ? active.map(o=>(
          <div key={o.id} onClick={()=>setSelected(o)} className="bg-white border border-[#ececec] rounded-xl p-4 shadow-sm active:scale-[0.99] transition" data-testid={`rider-course-${o.code}`}>
            <div className="flex justify-between items-start mb-1"><div className="font-semibold text-sm">{o.code}</div><span className="dina-chip" style={{color:statusColor[o.status]}}><span className="status-dot" style={{background:statusColor[o.status]}}/>{statusLabel[o.status]}</span></div>
            <div className="text-sm font-medium">{o.customer?.name}</div>
            <div className="text-xs text-[#666] flex items-center gap-1 mt-1"><MapPin size={11}/>{o.delivery_zone}</div>
            <div className="flex justify-between items-end mt-3"><div className="text-xs text-[#666]">{o.items.length} articles · {o.payment_method==="cod"?"Cash à collecter":"Déjà payé"}</div><div className="tabular font-semibold">{fcfa(o.total)}</div></div>
          </div>
        )) : <div className="text-center text-sm text-[#666] py-10">Aucune course active</div>)}

        {tab==="historique" && (history.length? history.map(o=>(
          <div key={o.id} className="bg-white border border-[#ececec] rounded-xl p-3">
            <div className="flex justify-between"><div className="font-medium text-sm">{o.code}</div><span className="status-dot" style={{background:statusColor[o.status]}}/></div>
            <div className="text-xs text-[#666]">{o.customer?.name} · {o.delivery_zone}</div>
            <div className="tabular text-sm font-semibold">{fcfa(o.total)}</div>
          </div>
        )): <div className="text-center text-sm text-[#666] py-10">Vide</div>)}

        {tab==="encaissements" && (
          <div className="space-y-3">
            <div className="bg-white border border-[#ececec] rounded-xl p-4"><div className="text-xs uppercase text-[#666] mb-1">À remettre à la boutique</div><div className="font-serif text-3xl tabular text-[#b02a2a]">{fcfa(cash)}</div></div>
            {history.filter(o=>o.payment_method==="cod" && o.status==="livree").map(o=><div key={o.id} className="bg-white border border-[#ececec] rounded-xl p-3 flex justify-between"><div><div className="text-sm font-medium">{o.code}</div><div className="text-xs text-[#666]">{o.customer?.name}</div></div><div className="tabular font-semibold">{fcfa(o.total)}</div></div>)}
          </div>
        )}

        {tab==="profil" && user && (
          <div className="bg-white border border-[#ececec] rounded-xl p-5 space-y-2">
            <div className="w-16 h-16 rounded-full bg-[#b02a2a] text-[#1c1c1c] grid place-items-center font-serif text-2xl mx-auto">{user.name?.[0]}</div>
            <div className="text-center font-semibold text-lg">{user.name}</div>
            <div className="text-center text-xs text-[#666] capitalize">{user.role}</div>
            <div className="text-sm text-[#666] text-center">{user.phone}</div>
            <div className="pt-3 text-sm space-y-1"><div className="flex justify-between"><span className="text-[#666]">Courses du mois</span><strong>{history.length}</strong></div><div className="flex justify-between"><span className="text-[#666]">Taux à l'heure</span><strong className="text-[#1f8a4c]">94%</strong></div></div>
          </div>
        )}
      </main>
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-[#ececec] max-w-md mx-auto grid grid-cols-4 h-16">
        {TABS.map(({key,label,icon:Icon})=>(
          <button key={key} onClick={()=>setTab(key)} className={`flex flex-col items-center justify-center text-[11px] ${tab===key?"text-[#b02a2a] font-semibold":"text-[#666]"}`} data-testid={`rider-tab-${key}`}><Icon size={18}/>{label.split(" ")[0]}</button>
        ))}
      </nav>

      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={()=>setSelected(null)}>
          <div className="bg-white w-full rounded-t-2xl p-5 max-h-[85vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="w-10 h-1 bg-[#ececec] rounded-full mx-auto mb-4"/>
            <div className="font-semibold text-lg">{selected.code}</div>
            <div className="text-sm text-[#666] mb-4">{selected.customer?.name} · {selected.delivery_zone}</div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <a href={`tel:${selected.customer?.phone}`} className="dina-btn-secondary !min-h-[48px] flex-col text-xs" data-testid="rider-call"><Phone size={16}/>Appeler</a>
              <a href={`https://wa.me/${(selected.customer?.phone||"").replace(/\D/g,"")}`} target="_blank" rel="noreferrer" className="dina-btn-secondary !min-h-[48px] flex-col text-xs" data-testid="rider-whatsapp"><MessageCircle size={16}/>WhatsApp</a>
              <a href={`https://maps.google.com/?q=${encodeURIComponent(selected.delivery_zone+" Abidjan")}`} target="_blank" rel="noreferrer" className="dina-btn-secondary !min-h-[48px] flex-col text-xs" data-testid="rider-map"><Navigation size={16}/>Carte</a>
            </div>
            <div className="space-y-1 mb-4">{selected.items.map((it,i)=><div key={i} className="flex justify-between text-sm"><span>{it.qty}× {it.name}</span><span className="tabular">{fcfa(it.qty*it.price)}</span></div>)}</div>
            <div className="flex justify-between font-semibold mb-4"><span>À encaisser</span><span className="tabular">{selected.payment_method==="cod"?fcfa(selected.total):"Déjà payé"}</span></div>
            <div className="space-y-2">
              <button onClick={()=>update("en_livraison")} className="dina-btn-primary w-full" data-testid="rider-start">En route</button>
              <button onClick={()=>update("livree")} className="dina-btn-secondary w-full" style={{background:"#1f8a4c",color:"white",borderColor:"#1f8a4c"}} data-testid="rider-delivered">Livrée</button>
              <button onClick={()=>update("echouee")} className="dina-btn-danger w-full" data-testid="rider-failed">Échec livraison</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
