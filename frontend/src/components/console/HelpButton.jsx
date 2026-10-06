import React, { useEffect, useState, useRef } from "react";
import { useLocation, Link } from "react-router-dom";
import api from "@/lib/api";
import { HelpCircle, X, ArrowRight, BookOpen } from "lucide-react";

export default function HelpButton() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [mod, setMod] = useState(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    api.get(`/manual/module-for-path?path=${encodeURIComponent(pathname)}`)
      .then(r => setMod(r.data && r.data.number ? r.data : null))
      .catch(() => setMod(null));
  }, [open, pathname]);

  useEffect(() => {
    const onClick = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); };
    if (open) window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(v => !v)}
        className="dina-chip"
        title="Aide contextuelle"
        data-testid="help-button"
      >
        <HelpCircle size={12}/> Aide
      </button>
      {open && (
        <div ref={panelRef} className="fixed top-0 right-0 bottom-0 w-[400px] max-w-full bg-white dark:bg-[#1a1a1a] border-l border-[#ececec] shadow-2xl z-50 flex flex-col" data-testid="help-panel">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#ececec]">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-[#b02a2a]"/>
              <div className="font-serif text-lg">Aide</div>
            </div>
            <button onClick={() => setOpen(false)}><X size={18}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!mod && <div className="text-sm text-[#666]">Aucun module associé à cette page. <Link to="/console/manuel" className="text-[#b02a2a] underline">Ouvrir le manuel</Link></div>}
            {mod && (
              <>
                <div className="text-[10px] uppercase tracking-widest text-[#999]">Module {String(mod.number).padStart(2,"0")}</div>
                <div className="font-serif text-xl">{mod.title}</div>
                <p className="text-sm text-[#666]">{mod.description}</p>
                <div className="space-y-2 pt-2">
                  {(mod.sections || []).map(s => (
                    <Link
                      key={s.id}
                      to={`/console/manuel/${mod.number}#${s.id}`}
                      onClick={() => setOpen(false)}
                      className="block p-3 rounded-lg bg-[#fafafa] hover:bg-[#fff5f5] text-sm"
                      data-testid={`help-section-${s.id}`}
                    >
                      <div className="font-medium flex items-center justify-between">{s.heading}<ArrowRight size={12} className="text-[#b02a2a]"/></div>
                    </Link>
                  ))}
                </div>
                <Link
                  to={`/console/manuel/${mod.number}`}
                  onClick={() => setOpen(false)}
                  className="dina-btn-primary w-full mt-3"
                  data-testid="help-open-module"
                >
                  Ouvrir le module complet
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
