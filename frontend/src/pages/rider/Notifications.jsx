import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { Bell, Package, MessageSquare, Megaphone, CheckCheck } from "lucide-react";
import { dateTimeFmt } from "@/lib/format";

const ICON = { delivery: Package, message: MessageSquare, announcement: Megaphone };
export const notifsChanged = () => window.dispatchEvent(new Event("rider-notifs-changed"));

export function NotifItem({ n, onOpen }) {
  const Icon = ICON[n.type] || Bell;
  return (
    <button onClick={() => onOpen(n)} className={`w-full text-left p-2.5 rounded-lg flex gap-2.5 ${n.read ? "opacity-75 hover:bg-[#fafafa] dark:hover:bg-[#242424]" : "bg-[color:var(--rider-accent)] dark:bg-[#242424]"}`} data-testid={`rider-notif-${n.id}`} data-read={n.read ? "1" : "0"}>
      <span className="w-8 h-8 rounded-full grid place-items-center shrink-0 bg-white dark:bg-[#1a1a1a] text-[color:var(--rider-primary)] border border-[#ececec] dark:border-[#2a2a2a]"><Icon size={15}/></span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5">
          <span className={`text-xs truncate ${n.read ? "" : "font-bold"}`}>{n.title}</span>
          {!n.read && <span className="w-2 h-2 rounded-full bg-[#b02a2a] shrink-0" data-testid={`rider-notif-unread-${n.id}`}/>}
        </span>
        <span className="block text-[11px] text-[#666] dark:text-[#aaa] break-words">{n.msg}</span>
        <span className="block text-[10px] text-[#999] mt-0.5">{dateTimeFmt(n.at)}</span>
      </span>
    </button>
  );
}

export function useOpenNotif(after) {
  const nav = useNavigate();
  return async (n) => {
    if (!n.read) { await api.post("/me/notifications/read", { ids: [n.id] }).catch(() => {}); notifsChanged(); }
    after?.(n);
    if (n.link) nav(n.link);
  };
}

export const markAllRead = async () => {
  try { await api.post("/me/notifications/read", {}); notifsChanged(); toast.success("Toutes les notifications sont marquées comme lues"); }
  catch { toast.error("Action impossible · réessayez"); }
};

export function FilterTabs({ value, onChange, unread }) {
  return (
    <div className="flex gap-1" data-testid="rider-notif-filters">
      {[["all", "Toutes"], ["unread", `Non lues${unread ? ` · ${unread}` : ""}`]].map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)} className={`px-3 py-1 rounded-full text-[11px] border ${value === v ? "bg-[color:var(--rider-primary)] text-white border-transparent" : "border-[#ececec] dark:border-[#2a2a2a] text-[#666]"}`} data-testid={`rider-notif-filter-${v}`}>{l}</button>
      ))}
    </div>
  );
}

export default function RiderNotifications() {
  const [filter, setFilter] = useState("all");
  const [items, setItems] = useState(null);
  const [unread, setUnread] = useState(0);
  const [more, setMore] = useState(false);
  const load = useCallback(async (before) => {
    try {
      const r = await api.get("/me/notifications", { params: { unread_only: filter === "unread", limit: 30, before } });
      setItems(prev => { if (!before) return r.data.items; const ids = new Set((prev || []).map(x => x.id)); return [...(prev || []), ...r.data.items.filter(x => !ids.has(x.id))]; });
      setUnread(r.data.unread); setMore(r.data.items.length === 30);
    } catch { setItems(p => p || []); toast.error("Notifications indisponibles · réessayez"); }
  }, [filter]);
  useEffect(() => {
    load();
    const f = () => load();
    window.addEventListener("rider-notifs-changed", f);
    return () => window.removeEventListener("rider-notifs-changed", f);
  }, [load]);
  const open = useOpenNotif();
  return (
    <div className="space-y-3" data-testid="rider-notifications-page">
      <div className="flex items-center justify-between gap-2">
        <div className="font-serif text-xl">Notifications</div>
        {unread > 0 && <button onClick={markAllRead} className="text-[11px] flex items-center gap-1 text-[color:var(--rider-primary)] font-semibold" data-testid="rider-notif-read-all-page"><CheckCheck size={13}/>Tout marquer comme lu</button>}
      </div>
      <FilterTabs value={filter} onChange={setFilter} unread={unread}/>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-[#ececec] dark:border-[#2a2a2a] p-1.5 space-y-1">
        {!items ? <div className="text-xs text-[#666] text-center py-8">Chargement…</div>
          : items.length === 0 ? <div className="text-xs text-[#666] text-center py-8" data-testid="rider-notif-empty">{filter === "unread" ? "Aucune notification non lue" : "Aucune notification"}</div>
          : items.map(n => <NotifItem key={n.id} n={n} onOpen={open}/>)}
      </div>
      {more && <button onClick={() => load(items[items.length - 1].at)} className="w-full text-xs py-2 rounded-lg border border-[#ececec] dark:border-[#2a2a2a]" data-testid="rider-notif-more">Voir les plus anciennes</button>}
    </div>
  );
}
