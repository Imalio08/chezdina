import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AppProvider } from "@/context/AppContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import Login from "@/pages/Login";
import ConsoleLayout from "@/components/layout/ConsoleLayout";
import StorefrontLayout from "@/components/layout/StorefrontLayout";
import Dashboard from "@/pages/console/Dashboard";
import POS from "@/pages/console/POS";
import Orders from "@/pages/console/Orders";
import Deliveries from "@/pages/console/Deliveries";
import Products from "@/pages/console/Products";
import Stock from "@/pages/console/Stock";
import Purchases from "@/pages/console/Purchases";
import Customers from "@/pages/console/Customers";
import Loyalty from "@/pages/console/Loyalty";
import Promotions from "@/pages/console/Promotions";
import Invoicing from "@/pages/console/Invoicing";
import Expenses from "@/pages/console/Expenses";
import Statistics from "@/pages/console/Statistics";
import Team from "@/pages/console/Team";
import Reviews from "@/pages/console/Reviews";
import AlertsAndCarts from "@/pages/console/AlertsAndCarts";
import Integrations from "@/pages/console/Integrations";
import Settings from "@/pages/console/Settings";
import SiteSettings from "@/pages/console/SiteSettings";
import Placeholder from "@/pages/console/Placeholder";
import FichesColis from "@/pages/console/FichesColis";
import RiderShell from "@/pages/rider/RiderShell";
import RiderCourses from "@/pages/rider/Courses";
import RiderCarte from "@/pages/rider/Carte";
import RiderHistorique from "@/pages/rider/Historique";
import RiderPerformance from "@/pages/rider/Performance";
import RiderProfil from "@/pages/rider/Profil";
import BonsPlans from "@/pages/storefront/BonsPlans";
import WhatsAppCampaigns from "@/pages/console/WhatsAppCampaigns";
import Referrals from "@/pages/console/Referrals";
import RolesPermissions from "@/pages/console/RolesPermissions";
import Kiosk from "@/pages/console/Kiosk";
import SectionBuilder from "@/pages/console/SectionBuilder";
import CmsPages from "@/pages/console/CmsPages";
import CashSessions from "@/pages/console/CashSessions";
import Encaissements from "@/pages/console/Encaissements";
import ProfitLoss from "@/pages/console/ProfitLoss";
import SiteAppearance from "@/pages/console/SiteAppearance";
import BrandsCategories from "@/pages/console/BrandsCategories";
import Marques from "@/pages/console/Marques";
import AcceptanceChecklist from "@/pages/console/AcceptanceChecklist";
import Rate from "@/pages/public/Rate";
import Rider from "@/pages/console/Rider";
import Home from "@/pages/storefront/Home";
import Catalog from "@/pages/storefront/Catalog";
import ProductPage from "@/pages/storefront/Product";
import Checkout from "@/pages/storefront/Checkout";
import Tracking from "@/pages/storefront/Tracking";
import Account from "@/pages/storefront/Account";
import SharedCart from "@/pages/storefront/SharedCart";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-sm text-[#666]">Chargement…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "rider") return <Navigate to="/rider" replace />;
  return children;
}
function ProtectedRider({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-sm text-[#666]">Chargement…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          <Toaster position="top-right" richColors />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/suivi/:code" element={<Tracking />} />
            <Route path="/boutique/panier-partage/:id" element={<SharedCart />} />
            <Route path="/rider" element={<ProtectedRider><RiderShell /></ProtectedRider>}>
              <Route index element={<ErrorBoundary><RiderCourses /></ErrorBoundary>} />
              <Route path="carte" element={<ErrorBoundary><RiderCarte /></ErrorBoundary>} />
              <Route path="historique" element={<ErrorBoundary><RiderHistorique /></ErrorBoundary>} />
              <Route path="performance" element={<ErrorBoundary><RiderPerformance /></ErrorBoundary>} />
              <Route path="profil" element={<ErrorBoundary><RiderProfil /></ErrorBoundary>} />
            </Route>
            <Route path="/boutique" element={<StorefrontLayout />}>
              <Route index element={<Home />} />
              <Route path="catalog" element={<Catalog />} />
              <Route path="product/:id" element={<ProductPage />} />
              <Route path="checkout" element={<Checkout />} />
              <Route path="account" element={<Account />} />
              <Route path="bons-plans" element={<BonsPlans />} />
            </Route>
            <Route path="/console" element={<Protected><ConsoleLayout /></Protected>}>
              <Route index element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
              <Route path="pos" element={<ErrorBoundary><POS /></ErrorBoundary>} />
              <Route path="commandes" element={<ErrorBoundary><Orders /></ErrorBoundary>} />
              <Route path="livraisons" element={<ErrorBoundary><Deliveries /></ErrorBoundary>} />
              <Route path="produits" element={<ErrorBoundary><Products /></ErrorBoundary>} />
              <Route path="stock" element={<ErrorBoundary><Stock /></ErrorBoundary>} />
              <Route path="achats" element={<ErrorBoundary><Purchases /></ErrorBoundary>} />
              <Route path="avis" element={<ErrorBoundary><Reviews /></ErrorBoundary>} />
              <Route path="clients" element={<ErrorBoundary><Customers /></ErrorBoundary>} />
              <Route path="fidelite" element={<ErrorBoundary><Loyalty /></ErrorBoundary>} />
              <Route path="promotions" element={<ErrorBoundary><Promotions /></ErrorBoundary>} />
              <Route path="alertes" element={<ErrorBoundary><AlertsAndCarts /></ErrorBoundary>} />
              <Route path="facturation" element={<ErrorBoundary><Invoicing /></ErrorBoundary>} />
              <Route path="depenses" element={<ErrorBoundary><Expenses /></ErrorBoundary>} />
              <Route path="statistiques" element={<ErrorBoundary><Statistics /></ErrorBoundary>} />
              <Route path="equipe" element={<ErrorBoundary><Team /></ErrorBoundary>} />
              <Route path="site" element={<ErrorBoundary><SiteSettings /></ErrorBoundary>} />
              <Route path="integrations" element={<ErrorBoundary><Integrations /></ErrorBoundary>} />
              <Route path="parametres" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
              {/* Placeholder routes for upcoming modules (keep sidebar functional) */}
              <Route path="factures" element={<ErrorBoundary><Placeholder/></ErrorBoundary>} />
              <Route path="sessions-caisse" element={<ErrorBoundary><CashSessions/></ErrorBoundary>} />
              <Route path="journees-livraison" element={<ErrorBoundary><Deliveries/></ErrorBoundary>} />
              <Route path="livreurs" element={<ErrorBoundary><Deliveries/></ErrorBoundary>} />
              <Route path="zones" element={<ErrorBoundary><Deliveries/></ErrorBoundary>} />
              <Route path="marques" element={<ErrorBoundary><Marques/></ErrorBoundary>} />
              <Route path="categories" element={<ErrorBoundary><Marques/></ErrorBoundary>} />
              <Route path="liste-attente" element={<ErrorBoundary><AlertsAndCarts/></ErrorBoundary>} />
              <Route path="fournisseurs" element={<ErrorBoundary><Purchases/></ErrorBoundary>} />
              <Route path="paniers-abandonnes" element={<ErrorBoundary><AlertsAndCarts/></ErrorBoundary>} />
              <Route path="parrainage" element={<ErrorBoundary><Referrals/></ErrorBoundary>} />
              <Route path="campagnes-whatsapp" element={<ErrorBoundary><WhatsAppCampaigns/></ErrorBoundary>} />
              <Route path="encaissements" element={<ErrorBoundary><Encaissements/></ErrorBoundary>} />
              <Route path="resultat" element={<ErrorBoundary><ProfitLoss/></ErrorBoundary>} />
              <Route path="employes" element={<ErrorBoundary><Team/></ErrorBoundary>} />
              <Route path="roles" element={<ErrorBoundary><RolesPermissions/></ErrorBoundary>} />
              <Route path="pointage" element={<ErrorBoundary><Kiosk/></ErrorBoundary>} />
              <Route path="apparence" element={<ErrorBoundary><SiteAppearance/></ErrorBoundary>} />
              <Route path="accueil" element={<ErrorBoundary><SectionBuilder/></ErrorBoundary>} />
              <Route path="apercu" element={<Navigate to="/boutique" replace/>} />
              <Route path="finances" element={<Navigate to="/console/resultat" replace/>} />
              <Route path="segments" element={<ErrorBoundary><WhatsAppCampaigns/></ErrorBoundary>} />
              <Route path="manuel" element={<ErrorBoundary><Placeholder title="Manuel d'utilisation" subtitle="Guides et tutoriels — bientôt disponible"/></ErrorBoundary>} />
              <Route path="pages" element={<ErrorBoundary><CmsPages/></ErrorBoundary>} />
              <Route path="menus" element={<ErrorBoundary><CmsPages/></ErrorBoundary>} />
              <Route path="seo" element={<ErrorBoundary><CmsPages/></ErrorBoundary>} />
              <Route path="checklist" element={<ErrorBoundary><AcceptanceChecklist/></ErrorBoundary>} />
              <Route path="fiches-colis" element={<ErrorBoundary><FichesColis/></ErrorBoundary>} />
            </Route>
            <Route path="/noter/:code" element={<ErrorBoundary><Rate/></ErrorBoundary>} />
            <Route path="/console/livreur" element={<ProtectedRider><ErrorBoundary><Rider /></ErrorBoundary></ProtectedRider>} />
            <Route path="/" element={<Navigate to="/console" replace />} />
            <Route path="*" element={<Navigate to="/console" replace />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
}
