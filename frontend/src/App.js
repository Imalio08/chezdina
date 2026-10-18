import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation, useNavigationType } from "react-router-dom";
import api from "@/lib/api";
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
import LivreurApp from "@/pages/console/LivreurApp";
import Placeholder from "@/pages/console/Placeholder";
import FichesColis from "@/pages/console/FichesColis";
import RiderShell from "@/pages/rider/RiderShell";
import RiderCourses from "@/pages/rider/Courses";
import RiderCarte from "@/pages/rider/Carte";
import RiderHistorique from "@/pages/rider/Historique";
import RiderPerformance from "@/pages/rider/Performance";
import RiderProfil from "@/pages/rider/Profil";
import RiderAvis from "@/pages/rider/Avis";
import RiderSolde from "@/pages/rider/Solde";
import RiderSignalements from "@/pages/rider/Signalements";
import RiderParametres from "@/pages/rider/Parametres";
import RiderMessages from "@/pages/rider/Messages";
import RiderNotifications from "@/pages/rider/Notifications";
import BonsPlans from "@/pages/storefront/BonsPlans";
import WhatsAppCampaigns from "@/pages/console/WhatsAppCampaigns";
import Referrals from "@/pages/console/Referrals";
import RolesPermissions from "@/pages/console/RolesPermissions";
import Approvals from "@/pages/console/Approvals";
import Audit from "@/pages/console/Audit";
import Kiosk from "@/pages/console/Kiosk";
import SectionBuilder from "@/pages/console/SectionBuilder";
import CmsPages from "@/pages/console/CmsPages";
import CashSessions from "@/pages/console/CashSessions";
import Encaissements from "@/pages/console/Encaissements";
import ProfitLoss from "@/pages/console/ProfitLoss";
import DeliveryDays from "@/pages/console/DeliveryDays";
import Riders from "@/pages/console/Riders";
import Zones from "@/pages/console/Zones";
import Opportunites from "@/pages/console/Opportunites";
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
import RiderDetail from "@/pages/console/RiderDetail";
import ProductDetail from "@/pages/console/ProductDetail";
import OrderDetail from "@/pages/console/OrderDetail";
import Messagerie from "@/pages/console/Messagerie";
import Segments from "@/pages/console/Segments";
import Campagnes from "@/pages/console/Campagnes";
import Statistiques from "@/pages/console/Statistiques";
import Finances from "@/pages/console/Finances";
import AcceptanceChecklist from "@/pages/console/AcceptanceChecklist";
import Rate from "@/pages/public/Rate";
import ScanRedirect from "@/pages/public/ScanRedirect";
import Nouveautes from "@/pages/storefront/Nouveautes";
import StorePromotions from "@/pages/storefront/Promotions";
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
import Invitation from "@/pages/storefront/Invitation";
import Tracking from "@/pages/storefront/Tracking";
import Account from "@/pages/storefront/Account";
import AccountShell from "@/pages/storefront/AccountShell";
import SharedCart from "@/pages/storefront/SharedCart";

import SubdomainRouter from "@/components/SubdomainRouter";
import BrandingBootstrapper from "@/components/BrandingBootstrapper";
import { ImageEditorHost } from "@/components/shared/ImageEditor";
import { PdfPreviewHost } from "@/components/shared/PdfPreview";
import RiderLogin from "@/pages/rider/RiderLogin";
import PunchGate from "@/components/shared/PunchGate";
import PopupGuard from "@/components/shared/PopupGuard";

function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="min-h-screen grid place-items-center text-sm text-[#666]">Chargement…</div>;
  if (!user) return <Navigate to="/console/connexion" replace state={{ from: location.pathname + location.search }} />;
  if (user.role === "rider") return <Navigate to="/riders" replace />;
  if (user.punch_required) return <PunchGate />;
  return children;
}
function ProtectedRider({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="min-h-screen grid place-items-center text-sm text-[#666]">Chargement…</div>;
  if (!user) return <Navigate to="/riders/connexion" replace state={{ from: location.pathname + location.search }} />;
  if (user.role !== "rider") return <Navigate to="/console" replace />;
  return children;
}
// Old URLs (/boutique/…, /rider/…) keep working: strip / swap the prefix, keep query + hash.
function Legacy({ from, to }) {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={`${(to + pathname.slice(from.length)) || "/"}${search}${hash}`} replace />;
}
function SlugRedirect() {
  const { slug } = useParams();
  const [miss, setMiss] = useState(false);
  useEffect(() => {
    api.get("/public/rider-cms").then(r => {
      const s = (r.data?.access_slug || "").toLowerCase();
      if (s && s === slug.toLowerCase()) window.location.replace("/riders"); else setMiss(true);
    }).catch(() => setMiss(true));
  }, [slug]);
  return miss ? <Navigate to="/" replace /> : <div className="min-h-screen grid place-items-center text-sm text-[#666]">Chargement…</div>;
}

const scrollMemo = {};
function ScrollToTop() {
  const { pathname, key } = useLocation();
  const type = useNavigationType();
  const keyRef = React.useRef(key);
  useEffect(() => {
    const f = () => { scrollMemo[keyRef.current] = window.scrollY; };
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);
  useEffect(() => {
    keyRef.current = key;
    if (type === "POP" && scrollMemo[key] != null) {
      const y = scrollMemo[key];
      let n = 0;
      const t = setInterval(() => { window.scrollTo(0, y); if (Math.abs(window.scrollY - y) < 2 || ++n > 20) clearInterval(t); }, 100);
      return () => clearInterval(t);
    }
    window.scrollTo(0, 0);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { keyRef.current = key; }, [key]);
  return null;
}

const MQ = "(max-width: 640px)";
function AppToaster() {
  const [mobile, setMobile] = useState(() => window.matchMedia(MQ).matches);
  useEffect(() => {
    const m = window.matchMedia(MQ); const f = (e) => setMobile(e.matches);
    m.addEventListener("change", f); return () => m.removeEventListener("change", f);
  }, []);
  return <Toaster position={mobile ? "top-center" : "top-right"} richColors closeButton={mobile} duration={mobile ? 4500 : 4000} visibleToasts={mobile ? 2 : 3} toastOptions={{ className: "dina-toast" }} />;
}

export default function App() {
  return (
    <AuthProvider>
      <ConfirmProvider>
      <AppProvider>
        <CustomerProvider>
        <BrowserRouter>
          <AppToaster />
          <PopupGuard />
          <ScrollToTop />
          <ImageEditorHost />
          <PdfPreviewHost />
          <BrandingBootstrapper />
          <SubdomainRouter />
          <Routes>
            <Route path="/console/connexion" element={<Login />} />
            <Route path="/login" element={<Legacy from="/login" to="/console/connexion" />} />
            <Route path="/scan" element={<ScanRedirect />} />
            <Route path="/suivi/:code" element={<Tracking />} />
            <Route path="/panier-partage/:id" element={<SharedCart />} />
            <Route path="/riders/connexion" element={<RiderLogin />} />
            <Route path="/rider/login" element={<Navigate to="/riders/connexion" replace />} />
            <Route path="/rider/*" element={<Legacy from="/rider" to="/riders" />} />
            <Route path="/boutique/*" element={<Legacy from="/boutique" to="" />} />
            <Route path="/riders" element={<ProtectedRider><RiderShell /></ProtectedRider>}>
              <Route index element={<ErrorBoundary><RiderCourses /></ErrorBoundary>} />
              <Route path="carte" element={<ErrorBoundary><RiderCarte /></ErrorBoundary>} />
              <Route path="historique" element={<ErrorBoundary><RiderHistorique /></ErrorBoundary>} />
              <Route path="performance" element={<ErrorBoundary><RiderPerformance /></ErrorBoundary>} />
              <Route path="profil" element={<ErrorBoundary><RiderProfil /></ErrorBoundary>} />
              <Route path="avis" element={<ErrorBoundary><RiderAvis /></ErrorBoundary>} />
              <Route path="solde" element={<ErrorBoundary><RiderSolde /></ErrorBoundary>} />
              <Route path="signalements" element={<ErrorBoundary><RiderSignalements /></ErrorBoundary>} />
              <Route path="parametres" element={<ErrorBoundary><RiderParametres /></ErrorBoundary>} />
              <Route path="messages" element={<ErrorBoundary><RiderMessages /></ErrorBoundary>} />
              <Route path="messages/:id" element={<ErrorBoundary><RiderMessages /></ErrorBoundary>} />
              <Route path="notifications" element={<ErrorBoundary><RiderNotifications /></ErrorBoundary>} />
            </Route>
            <Route path="/" element={<StorefrontLayout />}>
              <Route index element={<><OpeningHoursBanner/><Home /></>} />
              <Route path="catalog" element={<Catalog />} />
              <Route path="product/:id" element={<ProductPage />} />
              <Route path="checkout" element={<Checkout />} />
              <Route path="invitation/:code" element={<Invitation />} />
              <Route path="account" element={<Account />} />
              <Route path="compte/*" element={<AccountShell />} />
              <Route path="bons-plans" element={<BonsPlans />} />
              <Route path="nouveautes" element={<Nouveautes />} />
              <Route path="promotions" element={<StorePromotions />} />
              <Route path="guide-tailles" element={<GuideTailles />} />
              <Route path="livraison-retours" element={<LivraisonRetours />} />
              <Route path="suivi-commande" element={<Suivi />} />
              <Route path="suivi" element={<Navigate to="/suivi-commande" replace />} />
              <Route path="contact" element={<Contact />} />
            </Route>
            <Route path="/console" element={<Protected><ConsoleLayout /></Protected>}>
              <Route index element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
              <Route path="pos" element={<ErrorBoundary><POS /></ErrorBoundary>} />
              <Route path="commandes" element={<ErrorBoundary><Orders /></ErrorBoundary>} />
              <Route path="preparation" element={<Navigate to="/console/commandes?tab=confirmee" replace />} />
              <Route path="livraisons" element={<ErrorBoundary><DeliveryDays /></ErrorBoundary>} />
              <Route path="produits" element={<ErrorBoundary><Products /></ErrorBoundary>} />
              <Route path="stock" element={<ErrorBoundary><StockInventories /></ErrorBoundary>} />
              <Route path="achats" element={<ErrorBoundary><PurchaseOrders /></ErrorBoundary>} />
              <Route path="avis" element={<ErrorBoundary><Reviews /></ErrorBoundary>} />
              <Route path="clients" element={<ErrorBoundary><Customers /></ErrorBoundary>} />
              <Route path="clients/:id" element={<ErrorBoundary><CustomerDetail /></ErrorBoundary>} />
              <Route path="livreurs/:id" element={<ErrorBoundary><RiderDetail /></ErrorBoundary>} />
              <Route path="produits/:id" element={<ErrorBoundary><ProductDetail /></ErrorBoundary>} />
              <Route path="commandes/:code" element={<ErrorBoundary><OrderDetail /></ErrorBoundary>} />
              <Route path="messagerie" element={<ErrorBoundary><Messagerie /></ErrorBoundary>} />
              <Route path="fidelite" element={<ErrorBoundary><Loyalty /></ErrorBoundary>} />
              <Route path="promotions" element={<ErrorBoundary><Promotions /></ErrorBoundary>} />
              <Route path="alertes" element={<ErrorBoundary><AlertsAndCarts /></ErrorBoundary>} />
              <Route path="facturation" element={<ErrorBoundary><Invoicing /></ErrorBoundary>} />
              <Route path="depenses" element={<ErrorBoundary><Expenses /></ErrorBoundary>} />
              <Route path="statistiques" element={<ErrorBoundary><Statistiques /></ErrorBoundary>} />
              <Route path="equipe" element={<ErrorBoundary><Team /></ErrorBoundary>} />
              <Route path="site" element={<ErrorBoundary><SiteVitrine /></ErrorBoundary>} />
              <Route path="livreur-app" element={<ErrorBoundary><LivreurApp /></ErrorBoundary>} />
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
              <Route path="marques" element={<Navigate to="/console/categories?tab=marques" replace/>} />
              <Route path="categories" element={<ErrorBoundary><CategoriesCollections/></ErrorBoundary>} />
              <Route path="opportunites" element={<ErrorBoundary><Opportunites/></ErrorBoundary>} />
              <Route path="liste-attente" element={<Navigate to="/console/opportunites?tab=attente" replace/>} />
              <Route path="fournisseurs" element={<ErrorBoundary><Suppliers/></ErrorBoundary>} />
              <Route path="paniers-abandonnes" element={<Navigate to="/console/opportunites?tab=paniers" replace/>} />
              <Route path="parrainage" element={<ErrorBoundary><Referrals/></ErrorBoundary>} />
              <Route path="campagnes" element={<ErrorBoundary><Campagnes/></ErrorBoundary>} />
              <Route path="campagnes-whatsapp" element={<ErrorBoundary><Campagnes/></ErrorBoundary>} />
              <Route path="encaissements" element={<ErrorBoundary><Encaissements/></ErrorBoundary>} />
              <Route path="resultat" element={<ErrorBoundary><ProfitLoss/></ErrorBoundary>} />
              <Route path="employes" element={<ErrorBoundary><Team/></ErrorBoundary>} />
              <Route path="roles" element={<ErrorBoundary><RolesPermissions/></ErrorBoundary>} />
              <Route path="approbations" element={<ErrorBoundary><Approvals/></ErrorBoundary>} />
              <Route path="audit" element={<Navigate to="/console/parametres?tab=securite" replace/>} />
              <Route path="pointage" element={<ErrorBoundary><Kiosk/></ErrorBoundary>} />
              <Route path="presences" element={<ErrorBoundary><Pointage/></ErrorBoundary>} />
              <Route path="presence" element={<Navigate to="/console/presences" replace/>} />
              <Route path="apparence" element={<Navigate to="/console/site?tab=apparence" replace/>} />
              <Route path="accueil" element={<Navigate to="/console/site?tab=accueil" replace/>} />
              <Route path="apercu" element={<Navigate to="/" replace/>} />
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
            <Route path="/:slug" element={<SlugRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        </CustomerProvider>
      </AppProvider>
      </ConfirmProvider>
    </AuthProvider>
  );
}
