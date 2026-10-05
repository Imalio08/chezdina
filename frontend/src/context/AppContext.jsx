import React, { createContext, useContext, useEffect, useState } from "react";

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [storeId, setStoreId] = useState(() => localStorage.getItem("dina_store") || "all");
  const [lang, setLang] = useState(() => localStorage.getItem("dina_lang") || "fr");
  const [theme, setTheme] = useState(() => localStorage.getItem("dina_theme") || "light");
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem("dina_cart") || "[]"));
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(() => JSON.parse(localStorage.getItem("dina_pending") || "[]"));

  useEffect(() => { localStorage.setItem("dina_store", storeId); }, [storeId]);
  useEffect(() => { localStorage.setItem("dina_lang", lang); }, [lang]);
  useEffect(() => {
    localStorage.setItem("dina_theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  useEffect(() => { localStorage.setItem("dina_cart", JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem("dina_pending", JSON.stringify(pending)); }, [pending]);

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const addToCart = (p, qty = 1, size, color) => {
    setCart((c) => {
      const key = `${p.id}-${size || ""}-${color || ""}`;
      const idx = c.findIndex((x) => x.key === key);
      if (idx >= 0) { const n = [...c]; n[idx] = { ...n[idx], qty: n[idx].qty + qty }; return n; }
      return [...c, { key, product_id: p.id, name: p.name, image: p.image, price: p.price, size, color, qty }];
    });
  };
  const updateCartQty = (key, qty) => setCart((c) => c.map((x) => x.key === key ? { ...x, qty: Math.max(1, qty) } : x));
  const removeFromCart = (key) => setCart((c) => c.filter((x) => x.key !== key));
  const clearCart = () => setCart([]);

  return (
    <Ctx.Provider value={{ storeId, setStoreId, lang, setLang, theme, setTheme, cart, addToCart, updateCartQty, removeFromCart, clearCart, online, pending, setPending }}>
      {children}
    </Ctx.Provider>
  );
}
