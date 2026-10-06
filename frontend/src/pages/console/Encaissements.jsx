import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { toast } from "sonner";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["#b02a2a", "#1f8a4c", "#5867fd", "#e4991e", "#f4b12c", "#9333ea"];

export default function Encaissements() {
  const [days, setDays] = useState(7);
  const [d, setD] = useState(null);
  useEffect(() => { api.get(`/encaissements?days=${days}`).then(r => setD(r.data)).catch(() => toast.error("Erreur")); }, [days]);
  if (!d) return <div className="text-sm text-[#666]">Chargement…</div>;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Encaissements</h1><p className="text-sm text-[#666]">Par mode de paiement · trésorerie quotidienne</p></div>
        <div className="flex gap-1 bg-[#f5f5f5] dark:bg-[#1a1a1a] p-1 rounded-lg">
          {[7, 30, 90].map(x => <button key={x} onClick={() => setDays(x)} className={`px-3 py-1 text-xs rounded-md ${days === x ? "bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold" : ""}`} data-testid={`enc-days-${x}`}>{x} jours</button>)}
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Encaissé total</div><div className="font-serif text-2xl tabular mt-1 text-[#b02a2a]">{fcfa(d.total)}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Commandes</div><div className="font-serif text-2xl tabular mt-1">{d.count}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Panier moyen</div><div className="font-serif text-2xl tabular mt-1">{fcfa(d.count ? d.total / d.count : 0)}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Modes utilisés</div><div className="font-serif text-2xl tabular mt-1">{d.by_method.length}</div></div>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Répartition par mode</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart><Pie data={d.by_method} dataKey="total" nameKey="method" cx="50%" cy="50%" outerRadius={80} label>
              {d.by_method.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie><Legend wrapperStyle={{ fontSize: 12 }} /><Tooltip formatter={(v) => fcfa(v)} /></PieChart>
          </ResponsiveContainer>
        </div>
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Encaissé par jour</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d.daily}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" fontSize={10} /><YAxis fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} /><Tooltip formatter={(v) => fcfa(v)} /><Bar dataKey="total" fill="#b02a2a" /></BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="dina-card-white p-5">
        <div className="font-semibold mb-3">Détail par mode</div>
        <table className="dina-table"><thead><tr><th>Mode</th><th className="text-right">Commandes</th><th className="text-right">Total</th><th className="text-right">Part</th></tr></thead>
          <tbody>{d.by_method.map(m => (
            <tr key={m.method}><td className="font-medium capitalize">{m.method === "cod" ? "Paiement à la livraison" : m.method}</td><td className="text-right tabular">{m.count}</td><td className="text-right tabular font-semibold">{fcfa(m.total)}</td><td className="text-right tabular">{d.total ? Math.round(m.total / d.total * 100) : 0}%</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
