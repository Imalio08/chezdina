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
  rider: "Livreur",
};

// All active role options exposed in staff forms.
export const ACTIVE_ROLES = ["admin", "manager", "rider"];

// Explicit per-path access list (role keys allowed). "admin" is always implied.
export const PATH_ROLES = {
  // Operations — Gérante
  "/console": ["manager"],
  "/console/pos": ["manager"],
  "/console/commandes": ["manager"],
  "/console/preparation": ["manager"],
  "/console/sessions-caisse": ["manager"],
  "/console/liste-attente": ["manager"],
  "/console/paniers-abandonnes": ["manager"],
  "/console/livraisons": ["manager"],
  "/console/journees-livraison": ["manager"],
  "/console/livreurs": ["manager"],
  "/console/zones": ["manager"],
  "/console/produits": ["manager"],
  "/console/marques": ["manager"],
  "/console/categories": ["manager"],
  "/console/fournisseurs": ["manager"],
  "/console/achats": ["manager"],
  "/console/stock": ["manager"],
  "/console/clients": ["manager"],
  "/console/messagerie": ["manager"],
  "/console/segments": ["manager"],
  "/console/promotions": ["manager"],
  "/console/campagnes": ["manager"],
  "/console/campagnes-whatsapp": ["manager"],
  "/console/fidelite": ["manager"],
  "/console/parrainage": ["manager"],
  "/console/avis": ["manager"],
  "/console/statistiques": ["manager"],
  "/console/pointage": ["manager"],
  "/console/manuel": ["manager"],
  "/console/depenses": ["manager"],       // enregistre les dépenses, pas validation
  "/console/encaissements": ["manager"],  // enregistre les encaissements
  "/console/facturation": ["manager"],
  "/console/fiches-colis": ["manager"],
  "/console/alertes": ["manager"],

  // Supervision & finances — Propriétaire uniquement (duty segregation)
  "/console/finances": [],
  "/console/resultat": [],
  "/console/equipe": [],
  "/console/presence": [],
  "/console/site": [],
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
