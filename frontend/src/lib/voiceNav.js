// Turn-by-turn helpers: French instructions from OSRM steps + spoken guidance (Web Speech API).
const DIR = { left: "à gauche", right: "à droite", "slight left": "légèrement à gauche", "slight right": "légèrement à droite", "sharp left": "franchement à gauche", "sharp right": "franchement à droite", straight: "tout droit", uturn: "demi-tour" };

export function stepText(s) {
  const m = s.maneuver || {}; const d = DIR[m.modifier] || ""; const road = s.name ? ` sur ${s.name}` : "";
  switch (m.type) {
    case "depart": return `Démarrez${road}`;
    case "arrive": return "Vous êtes arrivé à destination";
    case "roundabout": case "rotary": return `Au rond-point, prenez la ${m.exit || 1}${m.exit === 1 ? "re" : "e"} sortie${road}`;
    case "merge": return `Insérez-vous ${d}${road}`;
    case "fork": return `À l'embranchement, restez ${d}${road}`;
    case "end of road": return `Au bout de la route, tournez ${d}${road}`;
    case "continue": case "new name": return m.modifier === "straight" || !d ? `Continuez tout droit${road}` : `Continuez ${d}${road}`;
    default: return m.modifier === "uturn" ? "Faites demi-tour" : d && m.modifier !== "straight" ? `Tournez ${d}${road}` : `Continuez tout droit${road}`;
  }
}

export const distM = (a, b) => {
  const R = 6371000, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

export const fmtDist = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.max(10, Math.round(m / 10) * 10)} m`);

export function speak(text, on = true) {
  if (!on || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = "fr-FR"; u.rate = 1;
  const v = window.speechSynthesis.getVoices().find((x) => x.lang?.startsWith("fr"));
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

export async function fetchRoute(from, to, signal) {
  const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`, { signal });
  const d = await r.json(); const rt = d.routes?.[0];
  if (!rt) return null;
  const steps = (rt.legs?.[0]?.steps || []).map((s) => ({ text: stepText(s), at: { lat: s.maneuver.location[1], lng: s.maneuver.location[0] }, dist: s.distance }));
  return { line: rt.geometry.coordinates.map(([lng, lat]) => [lat, lng]), km: rt.distance / 1000, min: rt.duration / 60, steps };
}

export const offRoute = (pos, line) => line.reduce((m, [lat, lng]) => Math.min(m, distM(pos, { lat, lng })), Infinity) > 80;
