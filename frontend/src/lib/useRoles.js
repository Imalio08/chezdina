import { useEffect, useState } from "react";
import api from "@/lib/api";

// All roles defined in the system (built-in + created), with their current name and active state
export function useRoles() {
  const [roles, setRoles] = useState([]);
  const load = () => api.get("/roles/all").then(r => setRoles(r.data || [])).catch(() => {});
  useEffect(() => { load(); }, []);
  return [roles, load];
}
