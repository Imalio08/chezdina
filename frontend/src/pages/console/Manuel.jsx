import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { GraduationCap, Search, ArrowRight, Check, Filter } from "lucide-react";
import * as Lucide from "lucide-react";

const ROLE_FILTERS = [
  { v: "", label: "Tous" },
  { v: "admin", label: "Propriétaire" },
  { v: "manager", label: "Gérante" },
  { v: "sales", label: "Vendeuse" },
  { v: "rider", label: "Livreur" },
  { v: "stock", label: "Stock" },
];

export default function Manuel() {
  const { user } = useAuth();
  const [modules, setModules] = useState([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [role, setRole] = useState(user?.role || "");

  useEffect(() => {
    const params = role ? `?role=${role}` : "";
    api.get(`/manual/modules${params}`).then(r => setModules(r.data || [])).catch(() => {});
  }, [role]);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      api.get(`/manual/search?q=${encodeURIComponent(q)}`).then(r => setResults(r.data || [])).catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-[#fff5f5] text-[#b02a2a] grid place-items-center shrink-0">
          <GraduationCap size={24}/>
        </div>
        <div className="flex-1">
          <h1 className="font-serif text-3xl">Manuel d'utilisation</h1>
          <p className="text-sm text-[#666] max-w-2xl mt-1">
            Apprenez à utiliser Chez Dina pas à pas. Chaque module couvre un domaine métier avec des objectifs clairs, des captures annotées et des guides numérotés. Les contenus sont modifiables par la propriétaire.
          </p>
        </div>
        <button onClick={() => window.dispatchEvent(new Event("dina-replay-tour"))} className="dina-btn-secondary !min-h-[40px] text-sm shrink-0" data-testid="manual-replay-tour"><GraduationCap size={14}/>Relancer la visite guidée</button>
      </div>

      <div className="dina-card-white p-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[260px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]"/>
          <input
            type="search"
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-[#fafafa] border border-[#ececec] focus:border-[#b02a2a] text-sm outline-none"
            placeholder="Rechercher dans le manuel…"
            value={q} onChange={e => setQ(e.target.value)}
            data-testid="manuel-search"
          />
          {results.length > 0 && q.trim().length >= 2 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#ececec] rounded-lg shadow-lg py-1 z-20 max-h-80 overflow-y-auto" data-testid="manuel-results">
              {results.slice(0, 10).map((r, i) => (
                <Link key={i} to={`/console/manuel/${r.module_number}${r.section_id ? `#${r.section_id}` : ""}`} className="block px-3 py-2 hover:bg-[#fff5f5] text-sm" data-testid={`manuel-result-${i}`}>
                  <div className="font-medium">Module {r.module_number} — {r.title}</div>
                  {r.heading && <div className="text-xs text-[#666]">{r.heading}</div>}
                  <div className="text-[10px] uppercase text-[#999]">{r.match}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter size={12} className="text-[#999]"/>
          {ROLE_FILTERS.map(f => (
            <button
              key={f.v}
              onClick={() => setRole(f.v)}
              className={`px-3 py-1.5 rounded-full text-xs ${role === f.v ? "bg-[#b02a2a] text-white font-semibold" : "bg-[#fafafa] text-[#666]"}`}
              data-testid={`manuel-role-${f.v || "all"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map(m => {
          const Icon = Lucide[m.icon] || Lucide.BookOpen;
          const pct = m.progress?.total ? Math.round((m.progress.done / m.progress.total) * 100) : 0;
          return (
            <Link
              key={m.number}
              to={`/console/manuel/${m.number}`}
              className="dina-card-white p-5 hover:shadow-md transition group block"
              data-testid={`manuel-card-${m.number}`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-[#fff5f5] text-[#b02a2a] grid place-items-center shrink-0 group-hover:bg-[#b02a2a] group-hover:text-white transition">
                  <Icon size={20}/>
                </div>
                <div className="flex-1">
                  <div className="text-[10px] uppercase tracking-widest text-[#999]">Module {String(m.number).padStart(2, "0")}</div>
                  <div className="font-serif text-lg leading-tight">{m.title}</div>
                </div>
              </div>
              <p className="text-sm text-[#666] mb-4">{m.description}</p>
              <div className="flex items-center justify-between">
                <div className="text-xs text-[#999]">{m.progress.done}/{m.progress.total} sections lues</div>
                <div className="flex items-center gap-1 text-sm text-[#b02a2a] font-semibold">
                  Ouvrir le module <ArrowRight size={14}/>
                </div>
              </div>
              {m.progress.total > 0 && (
                <div className="mt-2 h-1 bg-[#f0f0f0] rounded-full overflow-hidden">
                  <div className="h-full bg-[#b02a2a] rounded-full transition-all" style={{ width: `${pct}%` }}/>
                </div>
              )}
            </Link>
          );
        })}
        {modules.length === 0 && <div className="col-span-full text-center text-sm text-[#666] py-10">Aucun module pour ce rôle.</div>}
      </div>
    </div>
  );
}
