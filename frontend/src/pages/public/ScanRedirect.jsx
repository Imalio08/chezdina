import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { QrCode, Loader2, XCircle } from "lucide-react";

/**
 * Resolves a QR scan payload (?sku=&size=&color=&pid=) and redirects to the right
 * product variant. Logged-in staff → admin product page. Public → storefront.
 */
export default function ScanRedirect() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, error: null, product: null });

  useEffect(() => {
    const sku = params.get("sku") || "";
    const size = params.get("size") || "";
    const color = params.get("color") || "";
    const pid = params.get("pid") || "";

    const resolve = async () => {
      try {
        let product = null;
        if (pid) {
          const r = await api.get("/products").catch(() => ({ data: [] }));
          product = (r.data || []).find(p => p.id === pid);
        }
        if (!product && sku) {
          const r = await api.get("/products").catch(() => ({ data: [] }));
          product = (r.data || []).find(p => (p.sku || "").toLowerCase() === sku.toLowerCase());
        }
        if (!product) { setState({ loading: false, error: "Produit introuvable", product: null }); return; }
        setState({ loading: false, error: null, product });
        // Admin staff → console/produits with highlight; public → storefront
        const dest = user
          ? `/console/produits?highlight=${product.id}${size ? `&size=${encodeURIComponent(size)}` : ""}${color ? `&color=${encodeURIComponent(color)}` : ""}`
          : `/product/${product.id}${size || color ? `?${new URLSearchParams({ ...(size && { size }), ...(color && { color }) }).toString()}` : ""}`;
        setTimeout(() => nav(dest, { replace: true }), 600);
      } catch (e) {
        setState({ loading: false, error: "Erreur lecture catalogue", product: null });
      }
    };
    resolve();
  }, [params, user, nav]);

  return (
    <div className="min-h-screen grid place-items-center bg-[#fafafa] p-6">
      <div className="dina-card-white p-8 w-full max-w-md text-center" data-testid="scan-redirect">
        <div className="w-16 h-16 mx-auto rounded-full bg-[#fff5f5] grid place-items-center text-[#b02a2a] mb-4">
          {state.loading ? <Loader2 size={28} className="animate-spin"/> : state.error ? <XCircle size={28}/> : <QrCode size={28}/>}
        </div>
        {state.loading && <>
          <div className="font-serif text-xl mb-1">Lecture du QR…</div>
          <div className="text-sm text-[#666]">Redirection vers la variante en cours</div>
        </>}
        {!state.loading && state.error && <>
          <div className="font-serif text-xl mb-1">{state.error}</div>
          <div className="text-sm text-[#666] mb-4">Vérifiez que le QR appartient bien au catalogue Chez Dina.</div>
          <button onClick={() => nav(user ? "/console" : "/")} className="dina-btn-primary">Retour</button>
        </>}
        {!state.loading && state.product && <>
          <div className="font-serif text-xl mb-1">{state.product.name}</div>
          <div className="text-sm text-[#666]">Redirection en cours…</div>
        </>}
      </div>
    </div>
  );
}
