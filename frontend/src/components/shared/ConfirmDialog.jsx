import React, { useState, useCallback, createContext, useContext } from "react";
import { AlertTriangle, X } from "lucide-react";

const ConfirmContext = createContext(null);

/**
 * Universal confirm dialog provider.
 * Usage:
 *   const confirm = useConfirm();
 *   if (await confirm({ title, message, danger: true, confirmLabel: 'Supprimer' })) { ... }
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { title, message, confirmLabel, cancelLabel, danger, resolve }

  const confirm = useCallback((opts) => new Promise(resolve => {
    setState({ confirmLabel: "Continuer", cancelLabel: "Annuler", danger: false, ...opts, resolve });
  }), []);

  const close = (result) => { state?.resolve(result); setState(null); };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 bg-black/60 z-[90] grid place-items-center p-4" onClick={() => close(false)} data-testid="confirm-dialog">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full grid place-items-center ${state.danger ? "bg-[#fff5f5] text-[#c62828]" : "bg-[#fff5f5] text-[#b02a2a]"}`}>
                  <AlertTriangle size={18}/>
                </div>
                <div className="font-serif text-xl">{state.title || "Confirmer"}</div>
              </div>
              <button onClick={() => close(false)} className="text-[#999] hover:text-[#1c1c1c]"><X size={18}/></button>
            </div>
            {state.message && <div className="text-sm text-[#1c1c1c] dark:text-white/90 mb-5 whitespace-pre-wrap">{state.message}</div>}
            <div className="flex gap-2">
              <button onClick={() => close(false)} className="dina-btn-secondary flex-1" data-testid="confirm-cancel">{state.cancelLabel}</button>
              <button onClick={() => close(true)} className={`dina-btn-primary flex-1 ${state.danger ? "!bg-[#c62828]" : ""}`} data-testid="confirm-ok" autoFocus>{state.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Graceful fallback outside the provider — uses native confirm.
    return (opts) => Promise.resolve(window.confirm(`${opts?.title || ""}\n\n${opts?.message || ""}`.trim()));
  }
  return ctx;
}

export default useConfirm;
