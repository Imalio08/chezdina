// Role-based access control for the console.
// Keys = console pathnames (without query string). Values = roles with access.
// `admin` always has access to everything.
// If a path isn't listed here, it falls back to admin-only.
//
// Simplified Feb 2026 at owner's request: only 3 roles (admin = Propriétaire,
// manager = Gérante, rider = Livreur). The Gérante manages the shop end-to-end
// EXCEPT: finance/results, cash validation, role & team management, audit log,
// settings, PWA/CMS editing — reserved to the Propriétaire for duty segregation.

export const ROLE_LABELS = {
  admin: "Propriétaire",
  manager: "Gérante",
  sales: "Vendeuse",
  stock_keeper: "Magasinière",
  community_manager: "Community manager",
  rider: "Livreur",
};

// All active role options exposed in staff forms.
export const ACTIVE_ROLES = ["admin", "manager", "sales", "stock_keeper", "community_manager", "rider"];
export const LIMITED_ROLES = ["sales", "stock_keeper", "community_manager"];

const M = "manager", S = "sales", K = "stock_keeper", C = "community_manager";

// Explicit per-path access list (role keys allowed). "admin" is always implied.
// The server enforces the same split (backend/role_access.py).
export const PATH_ROLES = {
  // Operations
  "/console": [M, S, K, C],
  "/console/pos": [M, S],
  "/console/commandes": [M, S, K],
  "/console/preparation": [M, S, K],
  "/console/sessions-caisse": [M],
  "/console/liste-attente": [M, S],
  "/console/paniers-abandonnes": [M, S],
  "/console/livraisons": [M],
  "/console/journees-livraison": [M],
  "/console/livreurs": [M],
  "/console/zones": [M],
  "/console/produits": [M, S, K, C],
  "/console/marques": [M, K],
  "/console/categories": [M, K],
  "/console/fournisseurs": [M, K],
  "/console/achats": [M, K],
  "/console/stock": [M, S, K],
  "/console/clients": [M, S, C],
  "/console/messagerie": [M, S, C],
  "/console/segments": [M, C],
  "/console/promotions": [M, C],
  "/console/campagnes": [M, C],
  "/console/campagnes-whatsapp": [M, C],
  "/console/fidelite": [M, C],
  "/console/parrainage": [M, C],
  "/console/avis": [M, C],
  "/console/statistiques": [M],
  "/console/pointage": [M, S, K, C],
  "/console/manuel": [M, S, K, C],
  "/console/depenses": [M],       // enregistre les dépenses, pas validation
  "/console/encaissements": [M],  // enregistre les encaissements
  "/console/facturation": [M],
  "/console/fiches-colis": [M, K],
  "/console/alertes": [M, K],
  "/console/site": [C],

  // Supervision & finances — Propriétaire uniquement (duty segregation)
  "/console/finances": [],
  "/console/resultat": [],
  "/console/equipe": [],
  "/console/presence": [],
  "/console/livreur-app": [],
  "/console/integrations": [],
  "/console/parametres": [],
  "/console/roles": [],
  "/console/approbations": [],
  "/console/audit": [],
  "/console/checklist": [],
};

/** Returns true if the role can access the given path. */
export function canAccess(role, pathname) {
  if (!role) return false;
  if (role === "admin") return true;
  if (!pathname) return false;
  const path = pathname.split("?")[0];
  const keys = Object.keys(PATH_ROLES).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (path === key || path.startsWith(key + "/")) {
      return PATH_ROLES[key].includes(role);
    }
  }
  return false;
}

/** Returns the landing page for the given role (fallback = /console). */
export function landingFor(role) {
  if (role === "rider") return "/riders";
  return "/console";
}
