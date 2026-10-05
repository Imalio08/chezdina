export const fcfa = (n) => {
  const v = Math.round(Number(n || 0));
  return v.toLocaleString("fr-FR").replace(/,/g, " ") + " FCFA";
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
export const statusLabel = {
  nouvelle: "Nouvelle",
  confirmee: "Confirmée",
  en_preparation: "En préparation",
  prete: "Prête",
  assignee: "Assignée",
  en_livraison: "En livraison",
  livree: "Livrée",
  echouee: "Échouée",
  retournee: "Retournée",
  annulee: "Annulée",
};
export const statusColor = {
  nouvelle: "#0021cc",
  confirmee: "#3242e8",
  en_preparation: "#e4991e",
  prete: "#e4991e",
  assignee: "#5867fd",
  en_livraison: "#5867fd",
  livree: "#1f8a4c",
  echouee: "#c62828",
  retournee: "#666666",
  annulee: "#c62828",
};
