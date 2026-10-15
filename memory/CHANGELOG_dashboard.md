## 2026-10-15 — Tableau de bord console
- KPICard : écart calculé depuis la valeur exacte (valueFull) → plus de chiffres bruts ; écart compact FCFA, % avec virgule.
- ActionItems : délai d'attente en min / h / j.

## 2026-10-15 — Expérience mobile & retours visuels (site client)
- Toasts : sur téléphone en haut, centrés, agrandis (16px, bouton fermer) ; desktop en haut à droite (App.js AppToaster + index.css).
- ScrollToTop global à chaque changement de page.
- lib/reveal.js : défilement jusqu'au résultat + halo rouge (.dina-flash), cible le premier élément visible.
- Ajout panier : toast avec bouton « Voir le panier ». Catalogue : tri/filtres ramènent la grille en vue.
- Checkout : champ manquant ciblé + focus ; message d'erreur explicite.
- Suivi : résultat ramené en vue ; « Mes commandes récentes » corrigé (endpoint orders-split, bug de code obsolète) ; /boutique/suivi → /boutique/suivi-commande.
- Compte : une seule arborescence de routes (matchMedia 1024px) ; Aperçu accessible sur mobile via /boutique/compte/profil ; lien « ← Mon compte » ; états « Enregistrement… / Envoi… » ; cartes/adresses révélées après enregistrement ; messages défilent vers le dernier.
- Tests : iteration_72 (3 bugs trouvés) → iteration_73 100 %.
