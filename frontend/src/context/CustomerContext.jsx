import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

const Ctx = createContext(null);
export const useCustomer = () => useContext(Ctx);

const KEY = "dina_customer";

function readLocal() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch { return null; }
}
function writeLocal(data) {
  if (data) sessionStorage.setItem(KEY, JSON.stringify(data));
  else sessionStorage.removeItem(KEY);
}

export function CustomerProvider({ children }) {
  const [session, setSession] = useState(readLocal());
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(!!readLocal());

  const refresh = useCallback(async () => {
    const s = readLocal();
    if (!s?.token) { setCustomer(null); setLoading(false); return null; }
    try {
      const r = await api.get("/public/account/me", { headers: { Authorization: `Bearer ${s.token}` } });
      setCustomer(r.data.customer);
      return r.data.customer;
    } catch {
      writeLocal(null); setSession(null); setCustomer(null);
      return null;
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const loginDone = (data) => {
    writeLocal(data);
    setSession(data);
    setCustomer(data.customer);
  };
  const logout = async () => {
    try { await api.post("/public/customer-logout"); } catch {}
    writeLocal(null); setSession(null); setCustomer(null);
  };

  return (
    <Ctx.Provider value={{ customer, session, loading, loginDone, logout, refresh, setCustomer }}>
      {children}
    </Ctx.Provider>
  );
}
