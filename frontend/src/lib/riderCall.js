import api from "@/lib/api";
import { toast } from "sonner";

// Dials the customer without ever showing her number: allowed only while the course is En route / Arrivé (server-checked + logged).
export async function callCustomer(order) {
  if (order?.status !== "en_livraison") { toast.info("Appel possible quand la course est En route ou Arrivé"); return; }
  try { const { data } = await api.post(`/riders/me/orders/${order.id}/call`); window.location.href = `tel:${data.tel}`; }
  catch (e) { toast.error(e?.response?.data?.detail || "Appel impossible hors connexion · utilisez la messagerie"); }
}
