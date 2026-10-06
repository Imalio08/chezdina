import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import api from "@/lib/api";

const KEY = "dina_popup_seen";

export default function WelcomePopup() {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (sessionStorage.getItem(KEY)) return;
    api.get("/public/popup").then(r => {
      if (!r.data?.enabled) return;
      setData(r.data);
      const t = setTimeout(() => setOpen(true), (r.data.delay_s || 8) * 1000);
      return () => clearTimeout(t);
    }).catch(() => { });
  }, []);
  const close = () => { setOpen(false); sessionStorage.setItem(KEY, "1"); };
  if (!open || !data) return null;
  return (
    <div className="fixed inset-0 bg-black/70 z-[90] grid place-items-center p-4" onClick={close} data-testid="welcome-popup">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        {data.image && <div className="aspect-[16/9] bg-[#fff5f5]"><img src={data.image} alt="" className="w-full h-full object-cover" /></div>}
        <div className="p-6 text-center">
          <button onClick={close} className="absolute top-3 right-3 bg-white/90 dark:bg-black/60 rounded-full w-8 h-8 grid place-items-center" data-testid="popup-close"><X size={14} /></button>
          <h3 className="font-serif text-2xl mb-2">{data.title}</h3>
          <p className="text-sm text-[#666] mb-4">{data.offer}</p>
          {data.code && <div className="font-mono text-xl bg-[#fff5f5] dark:bg-[#2a1818] text-[#b02a2a] px-4 py-3 rounded-lg inline-block mb-4" data-testid="popup-code">{data.code}</div>}
          <button onClick={close} className="dina-btn-primary w-full !min-h-[46px]" data-testid="popup-shop">J'en profite</button>
        </div>
      </div>
    </div>
  );
}
