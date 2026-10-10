import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa, statusLabel, statusColor } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Check, X, Pencil, Trash2, Printer, Map, Shield, GripVertical, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import LeafletMap from "@/components/shared/LeafletMap";
import { VersementCell, missingVersements, OrderDayStatus } from "@/components/delivery/VersementCell";

export default function Deliveries() {
  const [tab, setTab] = useState("board");
  const [orders, setOrders] = useState([]);
  const [riders, setRiders] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [zones, setZones] = useState([]);
  const [locations, setLocations] = useState([]);
  const [showZoneForm, setShowZoneForm] = useState(false);
  const [reconcileFor, setReconcileFor] = useState(null); // {session, order}
  const [dragId, setDragId] = useState(null);

  const load = async () => {
    try {
      const [d, t, s, z] = await Promise.all([api.get("/deliveries"), api.get("/team"), api.get("/delivery-sessions"), api.get("/zones")]);
      setOrders(d.data); setRiders(t.data.filter(u => u.role === "rider")); setSessions(s.data); setZones(z.data);
    } catch { toast.error("Erreur de chargement"); }
  };
  const loadLocations = async () => {
    try { const r = await api.get("/riders/locations"); setLocations(r.data || []); } catch {}
  };
  useEffect(() => { load(); loadLocations(); }, []);
  useEffect(() => {
    if (tab !== "carte") return;
    const t = setInterval(loadLocations, 30000);
    return () => clearInterval(t);
  }, [tab]);

  const createSession = async (r) => {
    try { await api.post("/delivery-sessions", { rider_id: r.id, rider_name: r.name }); toast.success(`Journée ouverte pour ${r.name}`); load(); }
    catch { toast.error("Erreur"); }
  };
  const addToSession = async (sid, oid) => {
    try { await api.patch(`/delivery-sessions/${sid}/add-order`, { order_id: oid }); toast.success("Commande affectée"); load(); }
    catch { toast.error("Erreur affectation"); }
  };
  const closeSession = async (sid) => {
    if (!confirm("Clôturer la journée ?")) return;
    try { await api.patch(`/delivery-sessions/${sid}/close`); toast.success("Journée clôturée"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
  };

  const todayIso = new Date().toISOString().slice(0, 10);
  const toShip = orders.filter(o => ["prete", "confirmee", "nouvelle"].includes(o.status) && !o.rider_id && (!o.rescheduled_for || o.rescheduled_for <= todayIso));
  const openSessions = sessions.filter(s => !s.closed);

  // Drag & Drop handlers
  const onDragStart = (oid) => (e) => { setDragId(oid); e.dataTransfer.effectAllowed = "move"; };
  const onDropToSession = (sid) => (e) => {
    e.preventDefault();
    if (!dragId) return;
    addToSession(sid, dragId); setDragId(null);
  };
  const allowDrop = (e) => e.preventDefault();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Livraisons</h1><p className="text-sm text-[#666]">Journées livreurs, réconciliation, performance</p></div>
        <div className="flex gap-2">
          <Link to="/console/fiches-colis" className="dina-btn-secondary !min-h-[40px]" data-testid="print-today-labels"><Printer size={13} />Imprimer fiches du jour</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">À assigner</div><div className="font-serif text-2xl tabular">{toShip.length}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Journées ouvertes</div><div className="font-serif text-2xl tabular text-[#1f8a4c]">{openSessions.length}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Livreurs actifs</div><div className="font-serif text-2xl tabular">{riders.length}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">GPS en direct</div><div className="font-serif text-2xl tabular text-[#b02a2a]">{locations.length}</div></div>
      </div>

      <div className="flex gap-1 bg-[#f5f5f5] dark:bg-[#1a1a1a] p-1 rounded-lg w-fit overflow-x-auto">
        <button onClick={() => setTab("board")} className={`px-4 py-1.5 text-sm rounded-md whitespace-nowrap ${tab === "board" ? "bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold" : ""}`} data-testid="deliv-tab-board">Board d'affectation</button>
        <button onClick={() => setTab("sessions")} className={`px-4 py-1.5 text-sm rounded-md whitespace-nowrap ${tab === "sessions" ? "bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold" : ""}`} data-testid="deliv-tab-sessions">Journées livreurs</button>
        <button onClick={() => setTab("carte")} className={`px-4 py-1.5 text-sm rounded-md whitespace-nowrap ${tab === "carte" ? "bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold" : ""}`} data-testid="deliv-tab-carte"><Map size={11} className="inline -mt-0.5 mr-1" />Carte GPS</button>
        <button onClick={() => setTab("riders")} className={`px-4 py-1.5 text-sm rounded-md whitespace-nowrap ${tab === "riders" ? "bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold" : ""}`} data-testid="deliv-tab-riders">Livreurs</button>
        <button onClick={() => setTab("zones")} className={`px-4 py-1.5 text-sm rounded-md whitespace-nowrap ${tab === "zones" ? "bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold" : ""}`} data-testid="deliv-tab-zones">Zones</button>
      </div>

      {tab === "board" && (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          {/* Unassigned column */}
          <div className="dina-card-white p-3" data-testid="board-unassigned">
            <div className="font-semibold mb-3 text-sm flex items-center justify-between">
              <span>À assigner</span>
              <span className="dina-chip">{toShip.length}</span>
            </div>
            <div className="space-y-2 max-h-[640px] overflow-y-auto scrollbar-thin">
              {toShip.length === 0 && <div className="text-xs text-[#666] text-center py-8">Rien à assigner</div>}
              {toShip.map(o => (
                <div
                  key={o.id}
                  draggable
                  onDragStart={onDragStart(o.id)}
                  onDragEnd={() => setDragId(null)}
                  className={`border border-[#ececec] dark:border-[#2a2a2a] rounded-lg p-2.5 bg-white dark:bg-[#1a1a1a] cursor-move hover:shadow-md transition ${dragId === o.id ? "opacity-50 scale-95" : ""}`}
                  data-testid={`drag-order-${o.code}`}
                >
                  <div className="flex items-start gap-1.5">
                    <GripVertical size={14} className="text-[#999] mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start"><div className="font-medium text-xs">{o.code}</div><div className="tabular font-semibold text-xs">{fcfa(o.total)}</div></div>
                      <div className="text-[11px] text-[#666] truncate">{o.customer?.name}</div>
                      <div className="text-[11px] text-[#666] truncate">{o.delivery_zone || "—"}</div>
                      <div className="text-[10px] text-[#999] mt-0.5">{o.items?.length || 0} art · {o.payment_method === "cod" ? <span className="text-[#c62828] font-semibold">COD {fcfa(o.total)}</span> : <span className="text-[#1f8a4c]">Payé</span>}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rider columns */}
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-3 min-w-max">
              {riders.map(r => {
                const sess = openSessions.find(s => s.rider_id === r.id);
                const items = sess?.orders_detail || [];
                return (
                  <div
                    key={r.id}
                    className="w-[260px] dina-card-white p-3 shrink-0"
                    onDragOver={sess ? allowDrop : undefined}
                    onDrop={sess ? onDropToSession(sess.id) : undefined}
                    data-testid={`board-rider-${r.id}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-sm">{r.name}</div>
                      {sess
                        ? <span className="dina-chip" style={{ color: "#1f8a4c" }}><span className="status-dot" style={{ background: "#1f8a4c" }} />{items.length}</span>
                        : <button onClick={() => createSession(r)} className="text-xs text-[#b02a2a] font-semibold hover:underline" data-testid={`open-session-${r.id}`}>+ Ouvrir</button>}
                    </div>
                    {!sess && <div className="text-[11px] text-[#999] text-center py-6">Journée fermée</div>}
                    {sess && (
                      <div className="space-y-2 max-h-[560px] overflow-y-auto scrollbar-thin min-h-[80px]">
                        {items.length === 0 && <div className="text-[11px] text-[#999] text-center py-6 border-2 border-dashed border-[#ececec] dark:border-[#2a2a2a] rounded-lg">Glissez-déposez une commande ici</div>}
                        {items.map(o => (
                          <div key={o.id} className="border border-[#ececec] dark:border-[#2a2a2a] rounded-lg p-2 text-xs">
                            <div className="flex justify-between"><div className="font-semibold">{o.code}</div><OrderDayStatus order={o} small/></div>
                            <div className="text-[11px] text-[#666] truncate">{o.customer?.name}</div>
                            <div className="text-[11px] text-[#666] truncate">{o.delivery_zone}</div>
                            <div className="text-[10px] tabular mt-0.5">{o.payment_method === "cod" ? <span className={o.postponed_to ? "line-through text-[#999]" : "text-[#c62828] font-semibold"}>COD {fcfa(o.total)}</span> : <span className="text-[#1f8a4c]">Payé</span>}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === "sessions" && (
        <div className="space-y-4">{openSessions.length === 0 ? <div className="text-center text-sm text-[#666] py-10 dina-card">Aucune journée ouverte</div> :
          openSessions.map(s => (
            <div key={s.id} className="dina-card-white p-5" data-testid={`session-${s.id}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="font-serif text-xl">{s.rider_name}</div>
                  <div className="text-xs text-[#666]">Journée du {s.date} · {(s.orders || []).length} commande{(s.orders || []).length > 1 ? "s" : ""}</div>
                </div>
                <button onClick={() => closeSession(s.id)} disabled={missingVersements(s).length > 0} title={missingVersements(s).length ? "Toutes les livraisons payées à la livraison doivent être « Versé »" : ""} className="dina-btn-secondary !min-h-[36px] text-xs disabled:opacity-50 disabled:cursor-not-allowed" data-testid={`close-session-${s.id}`}>Clôturer journée</button>
              </div>
              {missingVersements(s).length > 0 && <div className="mb-3 p-2.5 rounded-lg bg-[#fff5f5] dark:bg-[#2a1818] text-xs text-[#c62828]" data-testid={`versements-missing-${s.id}`}>{missingVersements(s).length} livraison(s) non versée(s) : {missingVersements(s).map(o => o.code).join(", ")} — clôture bloquée</div>}

              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="p-3 bg-[#fff5f5] dark:bg-[#2a1818] rounded-lg"><div className="text-[10px] uppercase text-[#666]">À collecter</div><div className="font-serif text-lg tabular font-semibold">{fcfa(s.total_to_collect || 0)}</div></div>
                <div className="p-3 bg-[#fff5f5] dark:bg-[#2a1818] rounded-lg"><div className="text-[10px] uppercase text-[#666]">Déjà payées</div><div className="font-serif text-lg tabular">{s.prepaid_count || 0}</div></div>
                <div className="p-3 bg-[#fff5f5] dark:bg-[#2a1818] rounded-lg"><div className="text-[10px] uppercase text-[#666]">Livrées</div><div className="font-serif text-lg tabular text-[#1f8a4c]">{s.delivered_count || 0}</div></div>
                <div className="p-3 bg-[#fff5f5] dark:bg-[#2a1818] rounded-lg"><div className="text-[10px] uppercase text-[#666]">Encaissé</div><div className="font-serif text-lg tabular text-[#b02a2a]">{fcfa(s.collected_total || 0)}</div></div>
              </div>

              <div className="overflow-x-auto">
                <table className="dina-table">
                  <thead><tr><th>Code</th><th>Cliente</th><th>Zone</th><th>Statut</th><th className="text-right">À collecter</th><th>Montant reçu</th><th>Écart</th><th>Versement</th></tr></thead>
                  <tbody>{(s.orders_detail || []).map(o => {
                    const rec = s.reconciliations?.[o.id];
                    const isCod = o.payment_method === "cod";
                    const confirmed = typeof rec === "object" ? rec?.collected : !!rec;
                    const amount = typeof rec === "object" ? rec?.amount : null;
                    const ecart = typeof rec === "object" ? rec?.ecart : null;
                    return (
                      <tr key={o.id}>
                        <td className="font-medium">{o.code}</td>
                        <td>{o.customer?.name}</td>
                        <td>{o.delivery_zone}</td>
                        <td><OrderDayStatus order={o}/></td>
                        <td className={`text-right tabular font-semibold ${o.postponed_to ? "line-through text-[#999]" : ""}`}>{isCod ? fcfa(o.total) : "—"}</td>
                        <td className="tabular">{confirmed && amount != null ? fcfa(amount) : "—"}</td>
                        <td className={`tabular ${ecart > 0 ? "text-[#1f8a4c]" : ecart < 0 ? "text-[#c62828]" : "text-[#666]"}`}>{ecart != null ? (ecart > 0 ? "+" : "") + fcfa(ecart) : "—"}</td>
                        <td><VersementCell session={s} order={o} onVerse={(ord) => setReconcileFor({ session: s, order: ord })} onReload={load}/></td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "carte" && (
        <div className="space-y-3">
          <div className="dina-card-white p-3 flex items-center justify-between">
            <div className="text-sm">
              <strong>{locations.length}</strong> livreur{locations.length > 1 ? "s" : ""} en direct · maj auto toutes les 30s
            </div>
            <button onClick={loadLocations} className="dina-btn-secondary !min-h-[32px] text-xs" data-testid="refresh-locations">Rafraîchir</button>
          </div>
          {locations.length === 0
            ? <div className="dina-card-white p-10 text-center text-sm text-[#666]"><Map size={32} className="mx-auto mb-2 text-[#999]" />Aucun livreur n'a transmis sa position récemment.<br />Les livreurs doivent ouvrir leur espace et autoriser la géolocalisation.</div>
            : <LeafletMap markers={locations.map(l => ({ ...l, title: l.rider_name, subtitle: `Précision ${Math.round(l.accuracy || 0)}m` }))} height={520} />
          }
        </div>
      )}

      {tab === "riders" && (
        <div className="grid lg:grid-cols-2 gap-4">{riders.map(r => <RiderCard key={r.id} rider={r} />)}</div>
      )}

      {tab === "zones" && (
        <ZonesConfig zones={zones} onReload={load} showForm={showZoneForm} setShowForm={setShowZoneForm} />
      )}

      {reconcileFor && (
        <ReconcileLineModal
          session={reconcileFor.session}
          order={reconcileFor.order}
          onClose={() => setReconcileFor(null)}
          onDone={() => { setReconcileFor(null); load(); }}
        />
      )}
    </div>
  );
}

export function ReconcileLineModal({ session, order, onClose, onDone }) {
  const [amount, setAmount] = useState(order.total || 0);
  const [pin, setPin] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const ecart = (+amount || 0) - (order.total || 0);
  const submit = async () => {
    if (!pin || pin.length < 4) return toast.error("Entrez le PIN gérante (4 chiffres)");
    setLoading(true);
    try {
      await api.patch(`/delivery-sessions/${session.id}/reconcile`, { order_id: order.id, collected: true, amount: +amount, pin, note });
      toast.success("Livraison marquée versée");
      onDone();
    } catch (e) {
      toast.error(e.response?.data?.detail || "PIN invalide");
    } finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="font-serif text-xl">Encaissement {order.code}</div>
            <div className="text-xs text-[#666]">{order.customer?.name} · {order.delivery_zone}</div>
          </div>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <div className="p-3 bg-[#fff5f5] dark:bg-[#2a1818] rounded-lg mb-3 text-center">
          <div className="text-[10px] uppercase text-[#666]">À encaisser</div>
          <div className="font-serif text-2xl tabular font-semibold text-[#b02a2a]">{fcfa(order.total)}</div>
        </div>

        <label className="text-xs uppercase font-semibold text-[#666]">Montant reçu (FCFA)</label>
        <input type="number" className="dina-input mb-2 tabular text-lg" value={amount} onChange={e => setAmount(e.target.value)} data-testid="reconcile-amount" />

        {ecart !== 0 && (
          <div className={`p-2 rounded mb-3 text-sm ${ecart > 0 ? "bg-[#f0f9f4] dark:bg-[#1a2a1a] text-[#1f8a4c]" : "bg-[#fff5f5] dark:bg-[#2a1818] text-[#c62828]"}`}>
            Écart : {ecart > 0 ? "+" : ""}{fcfa(ecart)} ({ecart > 0 ? "surplus" : "manque"})
          </div>
        )}

        <label className="text-xs uppercase font-semibold text-[#666]">Note (optionnelle)</label>
        <input className="dina-input mb-3" placeholder="Ex. cliente a arrondi, change manquant…" value={note} onChange={e => setNote(e.target.value)} />

        <label className="text-xs uppercase font-semibold text-[#666] flex items-center gap-1"><Shield size={11} />PIN gérante (requis)</label>
        <input type="password" inputMode="numeric" maxLength={6} className="dina-input mb-4 tracking-[0.5em] text-center text-lg" placeholder="••••" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} data-testid="reconcile-pin" />

        <div className="flex gap-2">
          <button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button>
          <button onClick={submit} disabled={loading || !pin} className="dina-btn-primary flex-1" data-testid="reconcile-confirm">{loading ? "Validation…" : "Marquer versé"}</button>
        </div>
      </div>
    </div>
  );
}

function RiderCard({ rider }) {
  const [k, setK] = useState(null);
  useEffect(() => { api.get(`/riders/${rider.id}/kpis`).then(r => setK(r.data)).catch(() => { }); }, [rider.id]);
  return (
    <div className="dina-card-white p-5" data-testid={`rider-card-${rider.id}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-[#fde8e8] text-[#b02a2a] font-serif text-xl font-bold grid place-items-center">{rider.name[0]}</div>
        <div><div className="font-semibold">{rider.name}</div><div className="text-xs text-[#666]">{rider.phone}</div></div>
      </div>
      {k ? (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-[#fff5f5] dark:bg-[#2a1818] rounded"><div className="text-[10px] uppercase text-[#666]">Livraisons</div><div className="font-serif text-lg tabular">{k.delivered}</div></div>
          <div className="p-2 bg-[#fff5f5] dark:bg-[#2a1818] rounded"><div className="text-[10px] uppercase text-[#666]">Taux livraison</div><div className="font-serif text-lg tabular text-[#1f8a4c]">{k.delivery_rate}%</div></div>
          <div className="p-2 bg-[#fff5f5] dark:bg-[#2a1818] rounded"><div className="text-[10px] uppercase text-[#666]">Satisfaction</div><div className="font-serif text-lg tabular">★{k.satisfaction}</div></div>
          <div className="p-2 bg-[#fff5f5] dark:bg-[#2a1818] rounded"><div className="text-[10px] uppercase text-[#666]">Total</div><div className="font-serif text-lg tabular">{k.total}</div></div>
          <div className="p-2 bg-[#fff5f5] dark:bg-[#2a1818] rounded"><div className="text-[10px] uppercase text-[#666]">Échecs</div><div className="font-serif text-lg tabular text-[#c62828]">{k.failed}</div></div>
          <div className="p-2 bg-[#fff5f5] dark:bg-[#2a1818] rounded"><div className="text-[10px] uppercase text-[#666]">Taux annul.</div><div className="font-serif text-lg tabular text-[#e4991e]">{k.cancel_rate}%</div></div>
        </div>
      ) : <div className="text-xs text-[#666]">Chargement…</div>}
    </div>
  );
}

function ZonesConfig({ zones, onReload, showForm, setShowForm }) {
  const [editing, setEditing] = useState(null);
  const [f, setF] = useState({ name: "", fee: 1500 });
  const save = async () => {
    try {
      if (editing) await api.patch(`/zones/${editing.id}`, f);
      else await api.post("/zones", f);
      toast.success("Enregistré"); setShowForm(false); setEditing(null); setF({ name: "", fee: 1500 }); onReload();
    } catch { toast.error("Erreur"); }
  };
  const del = async (id) => { if (!confirm("Supprimer ?")) return; await api.delete(`/zones/${id}`); onReload(); };
  return (
    <div className="dina-card-white p-5">
      <div className="flex justify-between items-center mb-4"><div className="font-semibold">Zones de livraison ({zones.length})</div><button onClick={() => { setShowForm(true); setEditing(null); setF({ name: "", fee: 1500 }); }} className="dina-btn-primary !min-h-[38px]" data-testid="zone-new"><Plus size={14} />Nouvelle zone</button></div>
      <table className="dina-table">
        <thead><tr><th>Nom</th><th className="text-right">Frais</th><th></th></tr></thead>
        <tbody>{zones.map(z => (
          <tr key={z.id} data-testid={`zone-row-${z.name}`}>
            <td className="font-medium">{z.name}</td>
            <td className="text-right tabular font-semibold">{fcfa(z.fee)}</td>
            <td className="text-right"><button onClick={() => { setEditing(z); setF({ name: z.name, fee: z.fee }); setShowForm(true); }} className="text-[#0021cc] mr-2"><Pencil size={14} /></button><button onClick={() => del(z.id)} className="text-[#c62828]"><Trash2 size={14} /></button></td>
          </tr>
        ))}</tbody>
      </table>
      {showForm && <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={() => setShowForm(false)}><div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="font-serif text-xl mb-4">{editing ? "Modifier" : "Nouvelle"} zone</div>
        <input className="dina-input mb-2" placeholder="Nom (ex: Cocody)" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} data-testid="zone-name" />
        <input type="number" className="dina-input mb-4" placeholder="Frais FCFA" value={f.fee} onChange={e => setF({ ...f, fee: +e.target.value })} data-testid="zone-fee" />
        <div className="flex gap-2"><button onClick={() => setShowForm(false)} className="dina-btn-secondary flex-1">Annuler</button><button onClick={save} className="dina-btn-primary flex-1" data-testid="zone-save">Enregistrer</button></div>
      </div></div>}
    </div>
  );
}
