// Rider offline mode: day cache + action queue in IndexedDB (survives app close / phone restart).
import api from "@/lib/api";
import { getPosition } from "@/lib/permissions";

const DBN = "dina_rider_offline";
let dbp = null;
const db = () => dbp || (dbp = new Promise((res, rej) => {
  const r = indexedDB.open(DBN, 1);
  r.onupgradeneeded = () => { r.result.createObjectStore("ops", { keyPath: "id" }); r.result.createObjectStore("kv", { keyPath: "k" }); };
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
}));
const tx = async (store, mode, fn) => {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode); const s = t.objectStore(store); const out = fn(s);
    t.oncomplete = () => res(out?.result ?? out); t.onerror = () => rej(t.error);
  });
};
const emit = () => window.dispatchEvent(new Event("rider-sync-changed"));
export const isNetErr = (e) => !e?.response;

export const kvGet = async (k) => (await tx("kv", "readonly", s => s.get(k)))?.v;
export const kvSet = (k, v) => tx("kv", "readwrite", s => s.put({ k, v }));
export const allOps = async () => ((await tx("ops", "readonly", s => s.getAll())) || []).sort((a, b) => a.seq - b.seq);
export const pendingCount = async () => (await allOps()).length;

// Day reconciled & closed: wipe every cached customer data (courses, conversations) from the phone.
export async function purgeCustomerData() {
  await tx("kv", "readwrite", s => s.clear());
  try { Object.keys(localStorage).filter(k => /^dina_(rider_course|conv|order)/.test(k)).forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ }
}

const quickPos = () => getPosition({ ask: false, timeout: 4000, maximumAge: 120000, enableHighAccuracy: false }).then(c => c ? { lat: c.latitude, lng: c.longitude } : {});

let seqN = 0;
export async function enqueue(kind, fields) {
  const pos = await quickPos();
  const op = { id: (crypto.randomUUID && crypto.randomUUID()) || `op_${Date.now()}_${Math.random().toString(36).slice(2)}`, seq: Date.now() * 100 + (seqN++ % 100), kind, at: new Date().toISOString(), ...pos, ...fields };
  await tx("ops", "readwrite", s => s.put(op));
  emit();
  return op;
}

const COUNT = { a_livrer: ["confirmee", "prete", "assignee"], en_route: ["en_livraison"], livrees: ["livree"], annulees: ["annulee"], reportees: ["reportee"], echecs: ["echouee"] };
export function recount(day) {
  const orders = day.orders || [];
  const counts = Object.fromEntries(Object.entries(COUNT).map(([k, st]) => [k, orders.filter(o => st.includes(o.status)).length]));
  const collected = orders.filter(o => o.status === "livree" && o.payment_method === "cod").reduce((s, o) => s + ((o.proof || {}).amount_collected ?? o.total ?? 0), 0);
  const to_collect = orders.filter(o => o.payment_method === "cod" && !["livree", "annulee"].includes(o.status)).reduce((s, o) => s + (o.total || 0), 0);
  return { ...day, counts, collected, to_collect, balance_to_hand_over: collected };
}

export async function patchCachedOrder(oid, patch) {
  const day = await kvGet("today");
  if (!day) return null;
  const next = recount({ ...day, orders: day.orders.map(o => o.id === oid ? { ...o, ...patch, offline_pending: true } : o) });
  await kvSet("today", next);
  window.dispatchEvent(new Event("rider-day-changed"));
  return next;
}

const TILE = (lat, lng, z) => {
  const n = 2 ** z, x = Math.floor((lng + 180) / 360 * n);
  const r = lat * Math.PI / 180, y = Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n);
  return [x, y];
};
async function warmTiles(orders) {
  const pins = orders.map(o => o.customer || {}).filter(c => c.lat && c.lng);
  const urls = new Set();
  pins.forEach(c => [13, 14, 15, 16].forEach(z => {
    const [x, y] = TILE(c.lat, c.lng, z);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) urls.add(`https://${"abc"[(x + y) % 3]}.tile.openstreetmap.org/${z}/${x + dx}/${y + dy}.png`);
  }));
  const list = [...urls].slice(0, 600);
  for (let i = 0; i < list.length; i += 8) await Promise.all(list.slice(i, i + 8).map(u => fetch(u, { mode: "no-cors" }).catch(() => {})));
}

let lastWarm = 0;
export async function fetchDay() {
  try {
    const { data } = await api.get("/riders/me/today");
    if (data.day_closed && !(await pendingCount())) await purgeCustomerData();
    await kvSet("today", data); await kvSet("today_at", new Date().toISOString());
    if (Date.now() - lastWarm > 10 * 60000) { lastWarm = Date.now(); warmTiles(data.orders || []); }
    return { data, offline: false };
  } catch (e) {
    const data = await kvGet("today");
    if (data) return { data, offline: true };
    throw e;
  }
}

let flushing = false;
export async function flush() {
  if (flushing || !navigator.onLine) return { sent: 0 };
  flushing = true; emit();
  try {
    const ops = await allOps();
    if (!ops.length) return { sent: 0 };
    const { data } = await api.post("/rider/sync", { ops });
    const res = data.results || [];
    await tx("ops", "readwrite", s => res.filter(r => r.ok).forEach(r => s.delete(r.id)));
    const conflicts = res.filter(r => r.conflict);
    if (conflicts.length) window.dispatchEvent(new CustomEvent("rider-sync-conflicts", { detail: conflicts }));
    await kvSet("last_sync", new Date().toISOString());
    fetchDay().then(() => window.dispatchEvent(new Event("rider-day-changed"))).catch(() => {});
    return { sent: res.length, conflicts };
  } catch { return { sent: 0 }; }
  finally { flushing = false; emit(); }
}
export const isFlushing = () => flushing;

export function startRiderSync() {
  const run = () => { flush(); };
  window.addEventListener("online", run);
  const t = setInterval(run, 20000);
  run();
  return () => { window.removeEventListener("online", run); clearInterval(t); };
}
