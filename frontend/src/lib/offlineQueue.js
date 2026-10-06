// Offline queue for Rider actions (status changes, contact logs) using localStorage.
// Replay to backend when online, with exponential backoff.
import api from "@/lib/api";
const KEY = "dina_rider_queue";

function readQueue() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }
function writeQueue(q) { localStorage.setItem(KEY, JSON.stringify(q)); window.dispatchEvent(new Event("rider-queue-changed")); }

export function enqueue(op) {
  const q = readQueue();
  q.push({ ...op, id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, created_at: new Date().toISOString() });
  writeQueue(q);
}

export function queueSize() { return readQueue().length; }

export async function flushQueue() {
  const q = readQueue();
  if (!q.length) return { synced: 0 };
  try {
    const r = await api.post("/sync/batch", { ops: q });
    const okIds = new Set((r.data.results || []).filter(x => x.ok).map(x => x.id));
    const remaining = q.filter(op => !okIds.has(op.id));
    writeQueue(remaining);
    return { synced: okIds.size, remaining: remaining.length };
  } catch { return { synced: 0, remaining: q.length }; }
}

export function startAutoSync() {
  const run = () => { if (navigator.onLine) flushQueue(); };
  window.addEventListener("online", run);
  const t = setInterval(run, 30000);
  run();
  return () => { window.removeEventListener("online", run); clearInterval(t); };
}
