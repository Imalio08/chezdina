import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API_BASE, withCredentials: true });

api.interceptors.request.use((cfg) => {
  let t = localStorage.getItem("dina_token");
  if ((cfg.url || "").startsWith("/public/")) {
    try { const c = JSON.parse(localStorage.getItem("dina_customer") || "null"); if (c?.token) t = c.token; } catch { /* ignore */ }
  }
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

export default api;
