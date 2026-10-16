import React, { useEffect, useState } from "react";
import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { pendingCount, isFlushing, flush } from "@/lib/riderOffline";

export default function OfflineBar() {
  const [online, setOnline] = useState(navigator.onLine);
  const [n, setN] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const upd = () => { setOnline(navigator.onLine); setBusy(isFlushing()); pendingCount().then(setN).catch(() => {}); };
    upd();
    ["online", "offline", "rider-sync-changed"].forEach(e => window.addEventListener(e, upd));
    return () => ["online", "offline", "rider-sync-changed"].forEach(e => window.removeEventListener(e, upd));
  }, []);
  const plural = n > 1 ? "s" : "";
  if (!online) return <div className="sticky top-[57px] z-20 bg-[#8a5a00] text-white text-xs font-semibold px-4 py-1.5 flex items-center gap-2" data-testid="rider-offline-bar"><WifiOff size={13}/>Hors ligne · {n} action{plural} en attente</div>;
  if (busy || n > 0) return <button onClick={() => flush()} className="sticky top-[57px] z-20 w-full bg-[#e4991e] text-white text-xs font-semibold px-4 py-1.5 flex items-center gap-2" data-testid="rider-sync-bar"><RefreshCw size={13} className={busy ? "animate-spin" : ""}/>{busy ? "Synchronisation…" : `${n} action${plural} en attente · toucher pour synchroniser`}</button>;
  return <div className="sticky top-[57px] z-20 bg-[#eafaf1] dark:bg-[#12261a] text-[#1f6b3a] dark:text-[#7fd6a0] text-[11px] font-semibold px-4 py-1 flex items-center gap-1.5" data-testid="rider-synced-bar"><CheckCircle2 size={12}/>Synchronisé</div>;
}
