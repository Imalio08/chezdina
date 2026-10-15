import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/rbac";
import { useAuth } from "@/context/AuthContext";
import { ShoppingBag, Package, AlertTriangle, MessageSquare, Star, Megaphone, Truck, Clock, Target, Boxes } from "lucide-react";

const CARDS = {
  sales: [
    { k: "to_process", label: "À confirmer", icon: ShoppingBag, to: "/console/commandes?tab=nouvelle" },
    { k: "to_prepare", label: "À préparer", icon: Package, to: "/console/commandes?tab=confirmee" },
    { k: "unread_messages", label: "Messages non lus", icon: MessageSquare, to: "/console/messagerie" },
    { k: "waitlist", label: "Liste d'attente", icon: Clock, to: "/console/liste-attente" },
  ],
  stock_keeper: [
    { k: "to_prepare", label: "Commandes à préparer", icon: Package, to: "/console/commandes?tab=confirmee" },
    { k: "low_stock", label: "Stock faible (≤ 3)", icon: AlertTriangle, to: "/console/alertes" },
    { k: "out_of_stock", label: "Ruptures", icon: Boxes, to: "/console/stock" },
    { k: "purchases_pending", label: "Réceptions attendues", icon: Truck, to: "/console/achats" },
  ],
  community_manager: [
    { k: "unread_messages", label: "Messages non lus", icon: MessageSquare, to: "/console/messagerie" },
    { k: "reviews_pending", label: "Avis à modérer", icon: Star, to: "/console/avis" },
    { k: "active_promotions", label: "Promotions actives", icon: Target, to: "/console/promotions" },
    { k: "campaigns", label: "Campagnes", icon: Megaphone, to: "/console/campagnes" },
  ],
};

export default function RoleDashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => { api.get("/dashboard/role").then(r => setD(r.data)).catch(() => setErr(true)); }, []);
  const cards = CARDS[user?.role] || [];
  return (
    <div className="space-y-5" data-testid="role-dashboard">
      <div>
        <h1 className="font-serif text-3xl">Bonjour {user?.name?.split(" ")[0]}</h1>
        <p className="text-sm text-[#666]">{ROLE_LABELS[user?.role] || ""} · voici ce qui vous attend aujourd'hui</p>
      </div>
      {user?.role === "sales" && d && (
        <div className="dina-card p-5 flex items-center gap-4" data-testid="role-my-sales">
          <div className="w-12 h-12 rounded-full bg-[#fde8e8] grid place-items-center text-[#b02a2a]"><ShoppingBag size={20}/></div>
          <div>
            <div className="text-xs text-[#666] uppercase tracking-wide">Mes ventes du jour</div>
            <div className="text-2xl font-bold" data-testid="role-my-sales-total">{fcfa(d.my_sales_total)}</div>
            <div className="text-xs text-[#666]" data-testid="role-my-sales-count">{d.my_sales_count} vente(s) enregistrée(s) par vous</div>
          </div>
        </div>
      )}
      {err && <div className="dina-card p-4 text-sm text-[#b02a2a]" data-testid="role-dashboard-error">Tableau de bord indisponible · réessayez plus tard</div>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(({ k, label, icon: Icon, to }) => (
          <Link key={k} to={to} className="dina-card p-4 hover:border-[#b02a2a] transition-colors" data-testid={`role-card-${k}`}>
            <Icon size={18} className="text-[#b02a2a] mb-2"/>
            <div className="text-2xl font-bold">{d ? (d[k] ?? 0) : "…"}</div>
            <div className="text-xs text-[#666]">{label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
