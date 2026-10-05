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
import Rider from "@/pages/console/Rider";
import Home from "@/pages/storefront/Home";
import Catalog from "@/pages/storefront/Catalog";
import ProductPage from "@/pages/storefront/Product";
import Checkout from "@/pages/storefront/Checkout";
import Tracking from "@/pages/storefront/Tracking";
import Account from "@/pages/storefront/Account";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-sm text-[#666]">Chargement…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "rider") return <Navigate to="/console/livreur" replace />;
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
            <Route path="/boutique" element={<StorefrontLayout />}>
              <Route index element={<Home />} />
              <Route path="catalog" element={<Catalog />} />
              <Route path="product/:id" element={<ProductPage />} />
              <Route path="checkout" element={<Checkout />} />
              <Route path="account" element={<Account />} />
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
            </Route>
            <Route path="/console/livreur" element={<ProtectedRider><ErrorBoundary><Rider /></ErrorBoundary></ProtectedRider>} />
            <Route path="/" element={<Navigate to="/console" replace />} />
            <Route path="*" element={<Navigate to="/console" replace />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
}
