import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Save, Shield, Check, X } from "lucide-react";

const PERMISSIONS = [
  { key: "pos", label: "Caisse POS" },
  { key: "orders", label: "Commandes" },
  { key: "deliveries", label: "Livraisons" },
  { key: "products", label: "Produits" },
  { key: "stock", label: "Stock & inventaire" },
  { key: "customers", label: "Clientes" },
  { key: "expenses", label: "Dépenses" },
  { key: "team", label: "Équipe & paies" },
  { key: "settings", label: "Paramètres" },
];

const ROLES = [
  { key: "admin", label: "Admin" },
  { key: "manager", label: "Gérante" },
  { key: "sales", label: "Vendeuse" },
  { key: "stock_keeper", label: "Stock" },
  { key: "rider", label: "Livreur" },
];

export default function RolesPermissions() {
  const [matrix, setMatrix] = useState({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try { const r = await api.get("/roles-permissions"); setMatrix(r.data.matrix || {}); }
    catch { toast.error("Erreur"); }
  };
  useEffect(() => { load(); }, []);

  const toggle = (role, perm) => {
    if (role === "admin") return; // admin has all
    setMatrix({ ...matrix, [role]: { ...(matrix[role] || {}), [perm]: !matrix[role]?.[perm] } });
  };
  const save = async () => {
    setSaving(true);
    try { await api.patch("/roles-permissions", { matrix }); toast.success("Matrice enregistrée"); }
    catch { toast.error("Erreur · droits admin requis"); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Rôles & permissions</h1><p className="text-sm text-[#666]">Matrice des droits d'accès par rôle · admin a tous les droits</p></div>
        <button onClick={save} disabled={saving} className="dina-btn-primary !min-h-[40px]" data-testid="roles-save"><Save size={14} />{saving ? "Enregistrement…" : "Enregistrer"}</button>
      </div>

      <div className="dina-card-white p-5 overflow-x-auto">
        <table className="w-full text-sm" data-testid="roles-matrix">
          <thead>
            <tr>
              <th className="text-left pb-3 pr-4"><Shield size={14} className="inline mr-1" />Module</th>
              {ROLES.map(r => <th key={r.key} className="pb-3 px-3 text-center font-semibold text-[#666] uppercase text-xs">{r.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map(p => (
              <tr key={p.key} className="border-t border-[#ececec] dark:border-[#2a2a2a]">
                <td className="py-3 pr-4 font-medium">{p.label}</td>
                {ROLES.map(r => {
                  const on = r.key === "admin" || !!matrix[r.key]?.[p.key] || !!matrix[r.key]?.all;
                  return (
                    <td key={r.key} className="text-center py-3 px-3">
                      <button
                        onClick={() => toggle(r.key, p.key)}
                        disabled={r.key === "admin"}
                        className={`w-10 h-10 rounded-lg grid place-items-center transition ${on ? "bg-[#1f8a4c] text-white" : "bg-[#f5f5f5] dark:bg-[#2a2a2a] text-[#999]"} ${r.key === "admin" ? "opacity-70 cursor-not-allowed" : "hover:scale-105"}`}
                        data-testid={`perm-${r.key}-${p.key}`}
                      >
                        {on ? <Check size={16} /> : <X size={16} />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
