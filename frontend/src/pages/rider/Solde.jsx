import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import SubPage from "@/components/rider/SubPage";

const ecartOf = (s) => Object.values(s.reconciliations || {}).reduce((a, r) => a + (typeof r === "object" ? r.ecart || 0 : 0), 0);

export default function Solde() {
  const [today, setToday] = useState(null);
  const [hist, setHist] = useState([]);
  useEffect(() => {
    api.get("/riders/me/today").then(r => setToday(r.data)).catch(() => setToday({}));
    api.get("/riders/me/history?days=30").then(r => setHist(r.data || [])).catch(() => {});
  }, []);
  const coll30 = hist.reduce((s, x) => s + (x.collected_total || 0), 0);
  const ecart30 = hist.reduce((s, x) => s + ecartOf(x), 0);
  return (
    <SubPage title="Mon solde" testid="rider-solde-page">
      {!today ? <div className="text-sm text-[#666] text-center py-10">Chargement…</div> : <>
        <div className="dina-card-white p-5 text-center" data-testid="solde-to-hand">
          <div className="text-[10px] uppercase text-[#999]">À remettre à la boutique</div>
          <div className="font-serif text-4xl tabular text-[#b02a2a] mt-1">{fcfa(today.balance_to_hand_over || 0)}</div>
          <div className="text-xs text-[#666] mt-1">Espèces encaissées aujourd'hui, pas encore versées</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Box label="Encaissé aujourd'hui" v={fcfa(today.collected || 0)} c="#1f8a4c" t="solde-collected"/>
          <Box label="Reste à encaisser" v={fcfa(today.to_collect || 0)} c="#e4991e" t="solde-to-collect"/>
          <Box label="Encaissé sur 30 jours" v={fcfa(coll30)} t="solde-30"/>
          <Box label="Écarts sur 30 jours" v={fcfa(ecart30)} c={ecart30 >= 0 ? "#1f8a4c" : "#c62828"} t="solde-ecart"/>
        </div>
        <div className="text-[11px] text-[#666] px-1">Le détail jour par jour est dans Profil › Historique.</div>
      </>}
    </SubPage>
  );
}

function Box({ label, v, c, t }) { return <div className="dina-card-white p-3" data-testid={t}><div className="text-[10px] uppercase text-[#999]">{label}</div><div className="font-serif text-lg tabular mt-0.5" style={{ color: c }}>{v}</div></div>; }
