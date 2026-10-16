import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Star, TrendingUp, Trophy, MessageSquare } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import SubPage from "@/components/rider/SubPage";

const LEVEL_COLORS = { Bronze: "#cd7f32", Argent: "#9fa6ad", Or: "#f4b12c", Excellence: "#b02a2a" };

export default function Performance() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [reviews, setReviews] = useState([]);
  useEffect(() => {
    if (!user) return;
    api.get(`/riders/${user.id}/score`).then(r => setData(r.data)).catch(() => { });
    api.get(`/riders/${user.id}/reviews`).then(r => setReviews(r.data)).catch(() => { });
  }, [user]);

  if (!data) return <SubPage title="Performance" testid="rider-performance-page"><div className="text-sm text-[#666] text-center py-10">Chargement…</div></SubPage>;
  const scoreColor = LEVEL_COLORS[data.level] || "#666";
  const distribution = [5, 4, 3, 2, 1].map(s => ({ star: `${s}★`, count: reviews.filter(r => r.rating === s).length }));
  const componentsArr = [
    { k: "delivery_rate", label: "Taux de livraison", unit: "%" },
    { k: "punctuality", label: "Ponctualité", unit: "%" },
    { k: "rating", label: "Satisfaction cliente", unit: "/100" },
    { k: "cash", label: "Exactitude caisse", unit: "%" },
    { k: "proof", label: "Preuves complètes", unit: "%" },
  ];

  return (
    <SubPage title="Performance" testid="rider-performance-page">
      <div className="dina-card-white p-5 text-center" data-testid="rider-score">
        <div className="font-serif text-7xl tabular" style={{ color: scoreColor }}>{data.score}</div>
        <div className="text-xs uppercase tracking-widest text-[#999]">score sur 100</div>
        <span className="dina-chip mt-2" style={{ borderColor: scoreColor, color: scoreColor }}><Trophy size={11} />{data.level}</span>
      </div>

      <div className="dina-card-white p-4">
        <div className="font-semibold text-sm mb-1">Comment est calculé votre score ?</div>
        <div className="text-[11px] text-[#666] dark:text-[#999] mb-3 leading-relaxed">
          Votre score est noté sur <b>100 points</b>, cumul pondéré de 5 critères :
          taux de livraison, ponctualité, satisfaction cliente, exactitude de la caisse et preuves de remise.
          Niveaux : Bronze &lt; 60 · Argent 60-74 · Or 75-89 · Excellence ≥ 90.
        </div>
        {componentsArr.map(c => (
          <div key={c.k} className="mb-2" data-testid={`perf-${c.k}`}>
            <div className="flex justify-between text-xs mb-1"><span>{c.label} <span className="text-[#999]">({data.weights[c.k]}%)</span></span><span className="tabular font-semibold">{data.components[c.k]}{c.unit}</span></div>
            <div className="h-2 bg-[#f5f5f5] dark:bg-[#2a2a2a] rounded-full overflow-hidden"><div className="h-full" style={{ width: `${data.components[c.k]}%`, background: scoreColor }} /></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <KPI label="Livraisons" v={data.stats.delivered} c="#1f8a4c" />
        <KPI label="Total courses" v={data.stats.total} />
        <KPI label="Note moyenne" v={`${data.stats.rating_avg}★`} c="#f4b12c" />
        <KPI label="Écarts caisse" v={data.stats.cash_gaps} c={data.stats.cash_gaps === 0 ? "#1f8a4c" : "#c62828"} />
      </div>

      <div className="dina-card-white p-4">
        <div className="font-semibold text-sm mb-3 flex items-center gap-2"><Star size={14} className="text-[#f4b12c]" />Distribution des notes ({reviews.length})</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={distribution}><XAxis dataKey="star" fontSize={10} /><YAxis fontSize={10} /><Tooltip /><Bar dataKey="count">{distribution.map((_, i) => <Cell key={i} fill={["#1f8a4c", "#58b958", "#f4b12c", "#e4991e", "#c62828"][i]} />)}</Bar></BarChart>
        </ResponsiveContainer>
      </div>

      <ReviewsList reviews={reviews.slice(0, 20)} />
    </SubPage>
  );
}

export function ReviewsList({ reviews }) {
  return (
    <div className="dina-card-white p-4">
      <div className="font-semibold text-sm mb-3 flex items-center gap-2"><MessageSquare size={14} />Avis clientes</div>
      {reviews.length === 0 ? <div className="text-xs text-[#666] text-center py-6" data-testid="reviews-empty">Aucun avis pour le moment</div> :
        <div className="space-y-2">
          {reviews.map(r => (
            <div key={r.id} className="p-2.5 border border-[#ececec] dark:border-[#2a2a2a] rounded-lg" data-testid={`review-${r.id}`}>
              <div className="flex items-center justify-between">
                <div className="text-xs text-[#666]">{r.customer?.name} · {r.customer?.quartier}</div>
                <div className="text-[#f4b12c] tabular">{"★".repeat(r.rating)}<span className="text-[#ddd]">{"★".repeat(5 - r.rating)}</span></div>
              </div>
              {r.comment && <div className="text-sm mt-1">« {r.comment} »</div>}
              <div className="text-[10px] text-[#999] mt-0.5">{r.order_code}</div>
            </div>
          ))}
        </div>}
    </div>
  );
}

function KPI({ label, v, c }) { return <div className="dina-card-white p-3"><div className="text-[10px] uppercase text-[#999]">{label}</div><div className="font-serif text-xl tabular mt-0.5" style={{ color: c }}>{v}</div></div>; }
