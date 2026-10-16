// CMS links saved before the domain move may still start with /boutique.
export const siteLink = (l) => (typeof l === "string" ? (l.replace(/^\/boutique(?=\/|$|\?)/, "") || "/") : l);

export const fcfa = (n) => {
  const v = Math.round(Number(n || 0));
  return v.toLocaleString("fr-FR").replace(/[\u202f\u00a0]/g, " ") + " FCFA";
};
// Compact FCFA — "77,4 M FCFA" · "2,1 Md FCFA" · "12,5 k FCFA". Use full fcfa() for tooltip.
export const fcfaCompact = (n) => {
  const raw = Number(n || 0);
  const abs = Math.abs(raw);
  const sign = raw < 0 ? "-" : "";
  const fmt = (num, suffix) => {
    const r = Math.round(num * 10) / 10;
    const s = (Number.isInteger(r) ? String(r) : r.toFixed(1)).replace(".", ",");
    return `${sign}${s} ${suffix} FCFA`;
  };
  if (abs >= 1e9) return fmt(abs / 1e9, "Md");
  if (abs >= 1e6) return fmt(abs / 1e6, "M");
  if (abs >= 1e4) return fmt(abs / 1e3, "k");
  return fcfa(raw);
};
export const numCompact = (n) => {
  const raw = Number(n || 0);
  const abs = Math.abs(raw);
  const sign = raw < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}${(abs/1e9).toFixed(1).replace(".",",")} Md`;
  if (abs >= 1e6) return `${sign}${(abs/1e6).toFixed(1).replace(".",",")} M`;
  if (abs >= 1e4) return `${sign}${(abs/1e3).toFixed(1).replace(".",",")} k`;
  return Math.round(raw).toLocaleString("fr-FR").replace(/,/g, " ");
};
export const dateFmt = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
};
export const dateTimeFmt = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};
export const payInfo = (o) => {
  if (o.payment_status === "paye") return { label: "Payé", color: "#1f8a4c", paid: true };
  if (o.payment_status === "acompte_recu") return { label: "Acompte reçu", color: "#1f8a4c" };
  if (o.payment_status === "preuve_envoyee") return { label: "Wave à vérifier", color: "#e4991e" };
  if (o.payment_status === "preuve_refusee") return { label: "Preuve Wave refusée", color: "#c62828" };
  if (o.payment_method === "wave") return { label: "Wave non payé", color: "#c62828" };
  return { label: "Payé", color: "#1f8a4c", paid: true };
};
export const statusLabel = {
  en_attente_acompte: "En attente d'acompte",
  nouvelle: "À confirmer",
  confirmee: "À préparer",
  en_preparation: "En préparation",
  prete: "Prête",
  assignee: "Affectée",
  recuperee: "Récupérée",
  en_livraison: "En livraison",
  livree: "Livrée",
  echouee: "Échec",
  reportee: "Reportée",
  retournee: "Retournée",
  action_hors_ligne: "Action hors ligne à vérifier",
  annulee: "Annulée",
};
export const statusColor = {
  reportee: "#e4991e",
  en_attente_acompte: "#e4991e",
  nouvelle: "#0021cc",
  confirmee: "#3242e8",
  en_preparation: "#e4991e",
  prete: "#e4991e",
  assignee: "#5867fd",
  recuperee: "#5867fd",
  en_livraison: "#5867fd",
  livree: "#1f8a4c",
  echouee: "#c62828",
  retournee: "#666666",
  annulee: "#c62828",
};
