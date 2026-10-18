import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API_BASE, withCredentials: true });

export function deviceId() {
  let id = localStorage.getItem("dina_device_id");
  if (!id) { id = (crypto.randomUUID && crypto.randomUUID()) || `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`; localStorage.setItem("dina_device_id", id); }
  return id;
}

api.interceptors.request.use((cfg) => {
  let t = localStorage.getItem("dina_token");
  cfg.headers["X-Device-Id"] = deviceId();
  if ((cfg.url || "").startsWith("/public/")) {
    try { const c = JSON.parse(localStorage.getItem("dina_customer") || "null"); if (c?.token) t = c.token; } catch { /* ignore */ }
  }
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use((r) => r, (err) => {
  if (err?.response?.status === 428) window.dispatchEvent(new Event("punch-required"));
  if (err?.response?.status === 423) window.dispatchEvent(new Event("onboarding-required"));
  const d = err?.response?.data?.detail || "";
  if (err?.response?.status === 401 && /Session fermée|Accès désactivé/.test(d) && localStorage.getItem("dina_token")) {
    localStorage.removeItem("dina_token"); localStorage.removeItem("dina_rider_user");
    window.dispatchEvent(new CustomEvent("session-closed", { detail: d }));
  }
  return Promise.reject(err);
});

export default api;
