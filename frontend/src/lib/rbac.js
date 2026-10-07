// Role-based access control for the console.
// Keys = console pathnames (without query string). Values = roles with access.
// `admin` always has access to everything.
// If a path isn't listed here, it falls back to admin-only.

export const ROLE_LABELS = {
  admin: "Super Admin",
  manager: "Gérante",
  sales: "Vendeuse",
  stock_keeper: "Stock",
  community_manager: "Community Manager",
  rider: "Livreur",
};

// Explicit per-path access list (role keys allowed). "admin" is always implied.
export const PATH_ROLES = {
  "/console": ["manager", "sales", "stock_keeper", "community_manager"], // dashboard
  "/console/pos": ["manager", "sales"],
  "/console/commandes": ["manager", "sales"],
  "/console/preparation": ["manager", "sales", "stock_keeper"],
  "/console/sessions-caisse": ["manager", "sales"],
  "/console/liste-attente": ["manager", "sales"],
  "/console/paniers-abandonnes": ["manager", "community_manager"],
  "/console/livraisons": ["manager"],
  "/console/journees-livraison": ["manager"],
  "/console/livreurs": ["manager"],
  "/console/zones": ["manager"],
  "/console/produits": ["manager", "stock_keeper"],
  "/console/marques": ["manager", "stock_keeper"],
  "/console/categories": ["manager", "stock_keeper"],
  "/console/fournisseurs": ["manager", "stock_keeper"],
  "/console/achats": ["manager", "stock_keeper"],
  "/console/stock": ["manager", "stock_keeper"],
  "/console/clients": ["manager", "sales", "community_manager"],
  "/console/messagerie": ["manager", "sales", "community_manager"],
  "/console/segments": ["manager", "community_manager"],
  "/console/promotions": ["manager", "community_manager"],
  "/console/campagnes": ["manager", "community_manager"],
  "/console/campagnes-whatsapp": ["manager", "community_manager"],
  "/console/fidelite": ["manager", "community_manager"],
  "/console/parrainage": ["manager", "community_manager"],
  "/console/avis": ["manager", "community_manager"],
  "/console/equipe": ["manager"], // view-only lookups
  "/console/pointage": ["manager", "sales", "stock_keeper", "community_manager"], // kiosk tablet
  "/console/presence": ["manager"], // historique pointages
  "/console/site": ["manager", "community_manager"],
  "/console/statistiques": ["manager", "community_manager"],
  "/console/finances": ["manager"],
  "/console/depenses": ["manager"],
  "/console/encaissements": ["manager"],
  "/console/resultat": ["manager"],
  "/console/facturation": ["manager"],
  "/console/manuel": ["manager", "sales", "stock_keeper", "community_manager"],
  "/console/alertes": ["manager"],
  "/console/integrations": [],
  "/console/parametres": [],
  "/console/roles": [],
  "/console/approbations": [],
  "/console/audit": [],
  "/console/checklist": [],
  "/console/fiches-colis": ["manager"],
};

/** Returns true if the role can access the given path. */
export function canAccess(role, pathname) {
  if (!role) return false;
  if (role === "admin") return true;
  if (!pathname) return false;
  // Strip query string
  const path = pathname.split("?")[0];
  // Exact match or prefix match (e.g. /console/clients/:id)
  for (const key of Object.keys(PATH_ROLES)) {
    if (path === key || path.startsWith(key + "/")) {
      return PATH_ROLES[key].includes(role);
    }
  }
  return false; // default deny
}

/** Returns the landing page for the given role (fallback = /console). */
export function landingFor(role) {
  if (role === "admin" || role === "manager" || role === "sales" || role === "community_manager") return "/console";
  if (role === "stock_keeper") return "/console/produits";
  return "/console";
}
