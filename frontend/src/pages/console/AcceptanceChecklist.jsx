import React, { useEffect, useState } from "react";
import { Check, X, Circle } from "lucide-react";
import api from "@/lib/api";

const CHECKS = [
  { k: "orders", label: "Au moins 1 commande créée", test: async () => (await api.get("/orders")).data.length > 0 },
  { k: "customers", label: "Au moins 10 clientes", test: async () => (await api.get("/customers")).data.length >= 10 },
  { k: "products", label: "Au moins 10 produits actifs", test: async () => (await api.get("/products")).data.length >= 10 },
  { k: "zones", label: "Zones de livraison configurées", test: async () => (await api.get("/zones")).data.length > 0 },
  { k: "sections", label: "Vitrine : au moins 1 section active", test: async () => (await api.get("/public/storefront/sections")).data.length > 0 },
  { k: "pages", label: "Pages CMS : À propos / CGV / Livraison / FAQ", test: async () => (await api.get("/pages")).data.length >= 4 },
  { k: "loyalty", label: "Programme fidélité actif", test: async () => (await api.get("/loyalty/settings")).data.enabled === true },
  { k: "roles", label: "Matrice rôles & permissions définie", test: async () => Object.keys((await api.get("/roles-permissions")).data.matrix || {}).length >= 3 },
  { k: "wa_outbox", label: "Au moins 1 message WhatsApp enfilé", test: async () => (await api.get("/whatsapp-outbox")).data.length > 0 },
  { k: "cash", label: "Au moins 1 session de caisse historique", test: async () => (await api.get("/cash-sessions")).data.length > 0 },
  { k: "brands", label: "Au moins 3 marques", test: async () => (await api.get("/brands")).data.length >= 3 },
  { k: "suppliers", label: "Au moins 1 fournisseur", test: async () => (await api.get("/suppliers")).data.length > 0 },
  { k: "team", label: "Au moins 2 utilisateurs internes", test: async () => (await api.get("/team")).data.length >= 2 },
  { k: "attendance", label: "Au moins 1 pointage enregistré", test: async () => (await api.get("/attendance/today")).data.length >= 0 },
  { k: "promotions", label: "Au moins 1 promotion active", test: async () => (await api.get("/promotions")).data.filter(p => p.active).length > 0 },
  { k: "integrations", label: "Intégrations configurées (ou option 'auto WA' active)", test: async () => (await api.get("/integrations")).data?.whatsapp_auto !== false },
];

export default function AcceptanceChecklist() {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    const next = {};
    for (const c of CHECKS) {
      try { next[c.k] = await c.test(); } catch { next[c.k] = false; }
    }
    setResults(next); setLoading(false);
  };
  useEffect(() => { run(); }, []);

  const passed = Object.values(results).filter(Boolean).length;
  const total = CHECKS.length;
  const pct = Math.round(passed / total * 100);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Checklist d'acceptation</h1><p className="text-sm text-[#666]">Section 12 du cahier des charges — vérification go-live</p></div>
        <button onClick={run} disabled={loading} className="dina-btn-primary !min-h-[40px]" data-testid="checklist-run">{loading ? "Vérification…" : "Relancer"}</button>
      </div>
      <div className="dina-card-white p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-24 h-24 rounded-full bg-[#fff5f5] grid place-items-center font-serif text-3xl tabular font-bold" style={{ color: pct >= 80 ? "#1f8a4c" : pct >= 50 ? "#e4991e" : "#c62828" }}>{pct}%</div>
          <div>
            <div className="font-serif text-2xl">{passed} / {total}</div>
            <div className="text-sm text-[#666]">tests passés</div>
            <div className="text-xs mt-1" style={{ color: pct >= 80 ? "#1f8a4c" : "#666" }}>
              {pct === 100 ? "🎉 Prêt pour le go-live" : pct >= 80 ? "Presque prêt" : "À compléter avant mise en production"}
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          {CHECKS.map(c => {
            const r = results[c.k];
            return (
              <div key={c.k} className="flex items-center gap-3 p-2.5 border border-[#ececec] dark:border-[#2a2a2a] rounded-lg" data-testid={`check-${c.k}`}>
                {r === undefined ? <Circle size={16} className="text-[#999]" /> : r ? <Check size={16} className="text-[#1f8a4c]" /> : <X size={16} className="text-[#c62828]" />}
                <div className="flex-1 text-sm">{c.label}</div>
                <span className={`text-xs font-semibold ${r ? "text-[#1f8a4c]" : r === false ? "text-[#c62828]" : "text-[#999]"}`}>{r === undefined ? "…" : r ? "OK" : "KO"}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
