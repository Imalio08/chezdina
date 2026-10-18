import React, { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("dina_token");
    if (!token) { setUser(false); setLoading(false); return; }
    (async () => {
      try {
        const { data } = await api.get("/auth/me");
        setUser(data);
        if (data?.role === "rider") localStorage.setItem("dina_rider_user", JSON.stringify(data));
      } catch (e) {
        const cached = !e.response && localStorage.getItem("dina_rider_user");
        setUser(cached ? JSON.parse(cached) : false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  useEffect(() => {
    const f = () => setUser(u => (u && u.role !== "admin" && u.role !== "rider") ? { ...u, punch_required: true } : u);
    window.addEventListener("punch-required", f);
    const o = () => setUser(u => (u && u.role !== "admin") ? { ...u, onboarding_required: true } : u);
    const sc = (e) => { setUser(false); import("sonner").then(m => m.toast.error(e.detail || "Session fermée")); };
    window.addEventListener("onboarding-required", o);
    window.addEventListener("session-closed", sc);
    return () => { window.removeEventListener("punch-required", f); window.removeEventListener("onboarding-required", o); window.removeEventListener("session-closed", sc); };
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (data.token) localStorage.setItem("dina_token", data.token);
    setUser(data.user);
    return data.user;
  };
  const loginPin = async (pin) => {
    const { data } = await api.post("/auth/login-pin", { pin });
    if (data.token) localStorage.setItem("dina_token", data.token);
    setUser(data.user);
    return data.user;
  };
  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("dina_token");
    localStorage.removeItem("dina_rider_user");
    setUser(false);
  };

  return <Ctx.Provider value={{ user, loading, login, loginPin, logout, setUser }}>{children}</Ctx.Provider>;
}
