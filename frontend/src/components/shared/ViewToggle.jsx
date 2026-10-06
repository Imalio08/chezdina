import React from "react";
import { Table, LayoutGrid, BarChart3, Columns3 } from "lucide-react";

const ICONS = { table: Table, grid: LayoutGrid, chart: BarChart3, kanban: Columns3 };
const LABELS = { table: "Tableau", grid: "Grille", chart: "Graphique", kanban: "Kanban" };

export default function ViewToggle({ value, onChange, options = ["table","grid"], tabKey }) {
  const change = (v) => {
    onChange?.(v);
    if (tabKey) localStorage.setItem(`dina_view_${tabKey}`, v);
  };
  return (
    <div className="inline-flex rounded-lg border border-[#ececec] dark:border-[#2a2a2a] p-0.5 bg-white dark:bg-[#1a1a1a]" data-testid="view-toggle">
      {options.map(opt => {
        const Icon = ICONS[opt];
        const active = value === opt;
        return (
          <button key={opt} onClick={()=>change(opt)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition ${active?"bg-[#b02a2a] text-white":"text-[#666] hover:text-[#1c1c1c] dark:hover:text-white"}`} data-testid={`view-${opt}`} title={LABELS[opt]}>
            <Icon size={13}/><span className="hidden md:inline">{LABELS[opt]}</span>
          </button>
        );
      })}
    </div>
  );
}

export function useStoredView(tabKey, defaultView = "table") {
  const [view, setView] = React.useState(() => localStorage.getItem(`dina_view_${tabKey}`) || defaultView);
  return [view, setView];
}
