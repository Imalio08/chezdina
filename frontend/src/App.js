import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AppProvider } from "@/context/AppContext";
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
import AskDina from "@/pages/console/AskDina";
import Integrations from "@/pages/console/Integrations";
import Settings from "@/pages/console/Settings";
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
            {/* Public storefront */}
            <Route path="/boutique" element={<StorefrontLayout />}>
              <Route index element={<Home />} />
              <Route path="catalog" element={<Catalog />} />
              <Route path="product/:id" element={<ProductPage />} />
              <Route path="checkout" element={<Checkout />} />
              <Route path="account" element={<Account />} />
            </Route>
            {/* Console */}
            <Route path="/console" element={<Protected><ConsoleLayout /></Protected>}>
              <Route index element={<Dashboard />} />
              <Route path="pos" element={<POS />} />
              <Route path="commandes" element={<Orders />} />
              <Route path="livraisons" element={<Deliveries />} />
              <Route path="produits" element={<Products />} />
              <Route path="stock" element={<Stock />} />
              <Route path="achats" element={<Purchases />} />
              <Route path="clients" element={<Customers />} />
              <Route path="fidelite" element={<Loyalty />} />
              <Route path="promotions" element={<Promotions />} />
              <Route path="facturation" element={<Invoicing />} />
              <Route path="depenses" element={<Expenses />} />
              <Route path="statistiques" element={<Statistics />} />
              <Route path="equipe" element={<Team />} />
              <Route path="assistant" element={<AskDina />} />
              <Route path="integrations" element={<Integrations />} />
              <Route path="parametres" element={<Settings />} />
            </Route>
            <Route path="/console/livreur" element={<ProtectedRider><Rider /></ProtectedRider>} />
            <Route path="/" element={<Navigate to="/boutique" replace />} />
            <Route path="*" element={<Navigate to="/boutique" replace />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
}
