import React from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Team from "@/pages/console/Team";
import Pointage from "@/pages/console/Pointage";
import RolesPermissions from "@/pages/console/RolesPermissions";

const TABS = [["employes", "Employés"], ["presences", "Présences"], ["roles", "Rôles & permissions", true]];

// Équipe: Employés, Présences, Rôles & permissions in one place
export default function TeamHub() {
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const tabs = TABS.filter(t => !t[2] || user?.role === "admin");
  const tab = tabs.find(t => t[0] === sp.get("onglet"))?.[0] || "employes";
  return (
    <div className="space-y-4" data-testid="team-hub">
      <div className="flex gap-1 bg-[#f5f5f5] dark:bg-[#141414] p-1 rounded-lg w-fit overflow-x-auto max-w-full">
        {tabs.map(([k, l]) => <button key={k} onClick={() => setSp({ onglet: k })} className={`px-4 py-1.5 text-sm rounded-md whitespace-nowrap ${tab === k ? "bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold" : ""}`} data-testid={`team-tab-${k}`}>{l}</button>)}
      </div>
      {tab === "employes" && <Team/>}
      {tab === "presences" && <Pointage/>}
      {tab === "roles" && <RolesPermissions/>}
    </div>
  );
}
