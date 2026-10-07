import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AppProvider } from "@/context/AppContext";
import { registerSW } from "@/lib/sw";
registerSW();
import { CustomerProvider } from "@/context/CustomerContext";
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
import Manuel from "@/pages/console/Manuel";
import ManuelModule from "@/pages/console/ManuelModule";
import SiteSettings from "@/pages/console/SiteSettings";
import SiteVitrine from "@/pages/console/SiteVitrine";
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
import Approvals from "@/pages/console/Approvals";
import Audit from "@/pages/console/Audit";
import Preparation from "@/pages/console/Preparation";
import Kiosk from "@/pages/console/Kiosk";
import SectionBuilder from "@/pages/console/SectionBuilder";
import CmsPages from "@/pages/console/CmsPages";
import CashSessions from "@/pages/console/CashSessions";
import Encaissements from "@/pages/console/Encaissements";
import ProfitLoss from "@/pages/console/ProfitLoss";
import DeliveryDays from "@/pages/console/DeliveryDays";
import Riders from "@/pages/console/Riders";
import Zones from "@/pages/console/Zones";
import Waitlist from "@/pages/console/Waitlist";
import AbandonedCarts from "@/pages/console/AbandonedCarts";
import Pointage from "@/pages/console/Pointage";
import SiteAppearance from "@/pages/console/SiteAppearance";
import BrandsCategories from "@/pages/console/BrandsCategories";
import Marques from "@/pages/console/MarquesV2";
import CategoriesCollections from "@/pages/console/CategoriesCollections";
import Suppliers from "@/pages/console/Suppliers";
import PurchaseOrders from "@/pages/console/PurchaseOrders";
import StockInventories from "@/pages/console/StockInventories";
import CustomerDetail from "@/pages/console/CustomerDetail";
import Messagerie from "@/pages/console/Messagerie";
import Segments from "@/pages/console/Segments";
import Campagnes from "@/pages/console/Campagnes";
import Statistiques from "@/pages/console/Statistiques";
import Finances from "@/pages/console/Finances";
import AcceptanceChecklist from "@/pages/console/AcceptanceChecklist";
import Rate from "@/pages/public/Rate";
import ScanRedirect from "@/pages/public/ScanRedirect";
import Nouveautes from "@/pages/storefront/Nouveautes";
import Promotions from "@/pages/storefront/Promotions";
import GuideTailles from "@/pages/storefront/GuideTailles";
import LivraisonRetours from "@/pages/storefront/LivraisonRetours";
import Suivi from "@/pages/storefront/Suivi";
import Contact from "@/pages/storefront/Contact";
import { ConfirmProvider } from "@/components/shared/ConfirmDialog";
import Rider from "@/pages/console/Rider";
import Home from "@/pages/storefront/Home";
import OpeningHoursBanner from "@/components/storefront/OpeningHoursBanner";
import Catalog from "@/pages/storefront/Catalog";
import ProductPage from "@/pages/storefront/Product";
import Checkout from "@/pages/storefront/Checkout";
import Tracking from "@/pages/storefront/Tracking";
import Account from "@/pages/storefront/Account";
import AccountShell from "@/pages/storefront/AccountShell";
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
      <ConfirmProvider>
      <AppProvider>
        <CustomerProvider>
        <BrowserRouter>
          <Toaster position="top-right" richColors />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/scan" element={<ScanRedirect />} />
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
              <Route index element={<><OpeningHoursBanner/><Home /></>} />
              <Route path="catalog" element={<Catalog />} />
              <Route path="product/:id" element={<ProductPage />} />
              <Route path="checkout" element={<Checkout />} />
              <Route path="account" element={<Account />} />
              <Route path="compte/*" element={<AccountShell />} />
              <Route path="bons-plans" element={<BonsPlans />} />
              <Route path="nouveautes" element={<Nouveautes />} />
              <Route path="promotions" element={<Promotions />} />
              <Route path="guide-tailles" element={<GuideTailles />} />
              <Route path="livraison-retours" element={<LivraisonRetours />} />
              <Route path="suivi-commande" element={<Suivi />} />
              <Route path="contact" element={<Contact />} />
            </Route>
            <Route path="/console" element={<Protected><ConsoleLayout /></Protected>}>
              <Route index element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
              <Route path="pos" element={<ErrorBoundary><POS /></ErrorBoundary>} />
              <Route path="commandes" element={<ErrorBoundary><Orders /></ErrorBoundary>} />
              <Route path="preparation" element={<ErrorBoundary><Preparation/></ErrorBoundary>} />
              <Route path="livraisons" element={<ErrorBoundary><DeliveryDays /></ErrorBoundary>} />
              <Route path="produits" element={<ErrorBoundary><Products /></ErrorBoundary>} />
              <Route path="stock" element={<ErrorBoundary><StockInventories /></ErrorBoundary>} />
              <Route path="achats" element={<ErrorBoundary><PurchaseOrders /></ErrorBoundary>} />
              <Route path="avis" element={<ErrorBoundary><Reviews /></ErrorBoundary>} />
              <Route path="clients" element={<ErrorBoundary><Customers /></ErrorBoundary>} />
              <Route path="clients/:id" element={<ErrorBoundary><CustomerDetail /></ErrorBoundary>} />
              <Route path="messagerie" element={<ErrorBoundary><Messagerie /></ErrorBoundary>} />
              <Route path="fidelite" element={<ErrorBoundary><Loyalty /></ErrorBoundary>} />
              <Route path="promotions" element={<ErrorBoundary><Promotions /></ErrorBoundary>} />
              <Route path="alertes" element={<ErrorBoundary><AlertsAndCarts /></ErrorBoundary>} />
              <Route path="facturation" element={<ErrorBoundary><Invoicing /></ErrorBoundary>} />
              <Route path="depenses" element={<ErrorBoundary><Expenses /></ErrorBoundary>} />
              <Route path="statistiques" element={<ErrorBoundary><Statistiques /></ErrorBoundary>} />
              <Route path="equipe" element={<ErrorBoundary><Team /></ErrorBoundary>} />
              <Route path="site" element={<ErrorBoundary><SiteVitrine /></ErrorBoundary>} />
              <Route path="integrations" element={<ErrorBoundary><Integrations /></ErrorBoundary>} />
              <Route path="parametres" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
              <Route path="manuel" element={<ErrorBoundary><Manuel /></ErrorBoundary>} />
              <Route path="manuel/:number" element={<ErrorBoundary><ManuelModule /></ErrorBoundary>} />
              {/* Placeholder routes for upcoming modules (keep sidebar functional) */}
              <Route path="factures" element={<ErrorBoundary><Placeholder/></ErrorBoundary>} />
              <Route path="sessions-caisse" element={<ErrorBoundary><CashSessions/></ErrorBoundary>} />
              <Route path="journees-livraison" element={<ErrorBoundary><Deliveries/></ErrorBoundary>} />
              <Route path="livreurs" element={<ErrorBoundary><Riders/></ErrorBoundary>} />
              <Route path="zones" element={<ErrorBoundary><Zones/></ErrorBoundary>} />
              <Route path="marques" element={<ErrorBoundary><Marques/></ErrorBoundary>} />
              <Route path="categories" element={<ErrorBoundary><CategoriesCollections/></ErrorBoundary>} />
              <Route path="liste-attente" element={<ErrorBoundary><Waitlist/></ErrorBoundary>} />
              <Route path="fournisseurs" element={<ErrorBoundary><Suppliers/></ErrorBoundary>} />
              <Route path="paniers-abandonnes" element={<ErrorBoundary><AbandonedCarts/></ErrorBoundary>} />
              <Route path="parrainage" element={<ErrorBoundary><Referrals/></ErrorBoundary>} />
              <Route path="campagnes" element={<ErrorBoundary><Campagnes/></ErrorBoundary>} />
              <Route path="campagnes-whatsapp" element={<ErrorBoundary><Campagnes/></ErrorBoundary>} />
              <Route path="encaissements" element={<ErrorBoundary><Encaissements/></ErrorBoundary>} />
              <Route path="resultat" element={<ErrorBoundary><ProfitLoss/></ErrorBoundary>} />
              <Route path="employes" element={<ErrorBoundary><Team/></ErrorBoundary>} />
              <Route path="roles" element={<ErrorBoundary><RolesPermissions/></ErrorBoundary>} />
              <Route path="approbations" element={<ErrorBoundary><Approvals/></ErrorBoundary>} />
              <Route path="audit" element={<ErrorBoundary><Audit/></ErrorBoundary>} />
              <Route path="pointage" element={<ErrorBoundary><Kiosk/></ErrorBoundary>} />
              <Route path="presence" element={<ErrorBoundary><Pointage/></ErrorBoundary>} />
              <Route path="apparence" element={<Navigate to="/console/site?tab=apparence" replace/>} />
              <Route path="accueil" element={<Navigate to="/console/site?tab=accueil" replace/>} />
              <Route path="apercu" element={<Navigate to="/boutique" replace/>} />
              <Route path="finances" element={<ErrorBoundary><Finances/></ErrorBoundary>} />
              <Route path="statistiques" element={<ErrorBoundary><Statistiques/></ErrorBoundary>} />
              <Route path="segments" element={<ErrorBoundary><Segments/></ErrorBoundary>} />
              <Route path="campagnes" element={<ErrorBoundary><Campagnes/></ErrorBoundary>} />
              <Route path="campagnes-whatsapp" element={<ErrorBoundary><Campagnes/></ErrorBoundary>} />
              <Route path="manuel" element={<ErrorBoundary><Placeholder title="Manuel d'utilisation" subtitle="Guides et tutoriels — bientôt disponible"/></ErrorBoundary>} />
              <Route path="pages" element={<Navigate to="/console/site?tab=pages" replace/>} />
              <Route path="menus" element={<Navigate to="/console/site?tab=pages" replace/>} />
              <Route path="seo" element={<Navigate to="/console/site?tab=seo" replace/>} />
              <Route path="checklist" element={<ErrorBoundary><AcceptanceChecklist/></ErrorBoundary>} />
              <Route path="fiches-colis" element={<ErrorBoundary><FichesColis/></ErrorBoundary>} />
            </Route>
            <Route path="/noter/:code" element={<ErrorBoundary><Rate/></ErrorBoundary>} />
            <Route path="/console/livreur" element={<ProtectedRider><ErrorBoundary><Rider /></ErrorBoundary></ProtectedRider>} />
            <Route path="/" element={<Navigate to="/console" replace />} />
            <Route path="*" element={<Navigate to="/console" replace />} />
          </Routes>
        </BrowserRouter>
        </CustomerProvider>
      </AppProvider>
      </ConfirmProvider>
    </AuthProvider>
  );
}
