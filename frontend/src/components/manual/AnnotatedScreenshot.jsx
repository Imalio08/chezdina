import React from "react";

/**
 * Pedagogical annotated screenshot for the user manual.
 * Renders an SVG mockup of a Chez Dina console screen with numbered red
 * callouts that match step numbers in the surrounding `steps` block.
 *
 * Usage block shape:
 *   { type: "annotated", screen: "pos_cart", caption: "Encaisser une vente",
 *     callouts: [ {x:14, y:12, n:1, label:"Scanner la cliente"}, ... ] }
 *
 * Coordinates are in % of a 1000×600 viewBox so they scale cleanly.
 */

const PALETTE = {
  bg: "#fafafa",
  card: "#ffffff",
  stroke: "#e5e5e5",
  text: "#1c1c1c",
  muted: "#999",
  primary: "#b02a2a",
  pink: "#fff5f5",
  blue: "#5867fd",
  green: "#1f8a4c",
  amber: "#e4991e",
};

/* --- Shared chrome: sidebar + topbar + content frame --- */
function Chrome({ children, title = "Chez Dina · Console" }) {
  return (
    <>
      {/* Window frame */}
      <rect x="0" y="0" width="1000" height="600" fill={PALETTE.bg}/>
      {/* Sidebar */}
      <rect x="0" y="0" width="180" height="600" fill="#1c1c1c"/>
      <circle cx="30" cy="30" r="14" fill={PALETTE.pink}/>
      <text x="30" y="34" textAnchor="middle" fontFamily="serif" fontSize="12" fill={PALETTE.primary} fontWeight="bold">CD</text>
      <text x="55" y="28" fontFamily="serif" fontSize="14" fill="#fff">Chez Dina</text>
      <text x="55" y="42" fontFamily="sans-serif" fontSize="8" fill={PALETTE.muted} letterSpacing="2">CONSOLE</text>
      {["Tableau de bord","Caisse","Commandes","Préparation","Livraisons","Produits","Clientes","Statistiques"].map((lbl, i) => (
        <g key={i} transform={`translate(14 ${80 + i*34})`}>
          <rect x="0" y="0" width="152" height="24" rx="4" fill={i === 0 ? "#2a2a2a" : "transparent"}/>
          <text x="10" y="16" fontFamily="sans-serif" fontSize="11" fill={i === 0 ? "#fff" : "#aaa"}>{lbl}</text>
        </g>
      ))}
      {/* Topbar */}
      <rect x="180" y="0" width="820" height="54" fill="#fff" stroke={PALETTE.stroke} strokeWidth="1"/>
      <rect x="200" y="16" width="320" height="22" rx="11" fill={PALETTE.bg} stroke={PALETTE.stroke}/>
      <text x="214" y="31" fontFamily="sans-serif" fontSize="10" fill={PALETTE.muted}>chercher produits, clientes…</text>
      <circle cx="960" cy="27" r="12" fill={PALETTE.pink}/>
      <text x="960" y="31" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fill={PALETTE.primary} fontWeight="bold">AO</text>
      <text x="825" y="31" textAnchor="end" fontFamily="sans-serif" fontSize="10" fill={PALETTE.muted}>{title}</text>
      {/* Content area */}
      <g transform="translate(180 54)">{children}</g>
    </>
  );
}

/* --- Screens --- */
const SCREENS = {
  pos_cart: () => (
    <Chrome title="Caisse POS">
      <rect x="20" y="18" width="500" height="500" rx="12" fill={PALETTE.card} stroke={PALETTE.stroke}/>
      <text x="40" y="46" fontFamily="serif" fontSize="18" fill={PALETTE.text}>Panier · Cliente : Awa K.</text>
      {[0,1,2].map(i => (
        <g key={i} transform={`translate(40 ${64 + i*54})`}>
          <rect x="0" y="0" width="460" height="46" rx="8" fill={PALETTE.bg}/>
          <rect x="6" y="6" width="34" height="34" rx="4" fill={PALETTE.pink}/>
          <text x="48" y="22" fontFamily="sans-serif" fontSize="11" fill={PALETTE.text}>Robe Harmattan {i+1}</text>
          <text x="48" y="34" fontFamily="sans-serif" fontSize="9" fill={PALETTE.muted}>Taille M · Noir</text>
          <text x="440" y="28" textAnchor="end" fontFamily="sans-serif" fontSize="11" fill={PALETTE.text} fontWeight="bold">×2</text>
        </g>
      ))}
      <line x1="40" y1="240" x2="500" y2="240" stroke={PALETTE.stroke}/>
      <text x="40" y="260" fontFamily="sans-serif" fontSize="10" fill={PALETTE.muted}>Sous-total</text>
      <text x="500" y="260" textAnchor="end" fontFamily="sans-serif" fontSize="11" fill={PALETTE.text}>45 000 FCFA</text>
      <text x="40" y="282" fontFamily="serif" fontSize="18" fill={PALETTE.primary} fontWeight="bold">TOTAL · 45 000 FCFA</text>
      <rect x="540" y="18" width="260" height="500" rx="12" fill={PALETTE.card} stroke={PALETTE.stroke}/>
      <text x="560" y="46" fontFamily="serif" fontSize="14" fill={PALETTE.text}>Paiement</text>
      {["Espèces","Wave","Orange","MTN","Mixte"].map((m, i) => (
        <g key={m} transform={`translate(560 ${64 + i*44})`}>
          <rect x="0" y="0" width="220" height="36" rx="6" fill={i === 0 ? PALETTE.pink : PALETTE.bg} stroke={i === 0 ? PALETTE.primary : PALETTE.stroke}/>
          <text x="14" y="22" fontFamily="sans-serif" fontSize="11" fill={i === 0 ? PALETTE.primary : PALETTE.text} fontWeight={i === 0 ? "bold" : "normal"}>{m}</text>
        </g>
      ))}
      <rect x="560" y="470" width="220" height="36" rx="6" fill={PALETTE.primary}/>
      <text x="670" y="493" textAnchor="middle" fontFamily="sans-serif" fontSize="12" fill="#fff" fontWeight="bold">Encaisser</text>
    </Chrome>
  ),
  orders_list: () => (
    <Chrome title="Commandes">
      <g transform="translate(20 18)">
        <text x="0" y="20" fontFamily="serif" fontSize="20" fill={PALETTE.text}>Commandes</text>
        {["Nouvelles 12","À préparer 8","Prêtes 5","En livraison 3","Livrées 42","Annulées 1"].map((k, i) => (
          <g key={i} transform={`translate(${i*125} 36)`}>
            <rect x="0" y="0" width="118" height="54" rx="8" fill={PALETTE.card} stroke={PALETTE.stroke}/>
            <text x="10" y="20" fontFamily="sans-serif" fontSize="8" fill={PALETTE.muted}>{k.split(" ")[0].toUpperCase()}</text>
            <text x="10" y="42" fontFamily="serif" fontSize="20" fill={PALETTE.primary} fontWeight="bold">{k.split(" ")[1]}</text>
          </g>
        ))}
        <rect x="0" y="104" width="760" height="400" rx="8" fill={PALETTE.card} stroke={PALETTE.stroke}/>
        <rect x="0" y="104" width="760" height="30" fill={PALETTE.bg}/>
        {["Code","Date","Cliente","Statut","Total","Facture"].map((h, i) => (
          <text key={h} x={14 + i*125} y="124" fontFamily="sans-serif" fontSize="9" fill={PALETTE.muted} fontWeight="bold">{h.toUpperCase()}</text>
        ))}
        {[0,1,2,3].map(r => (
          <g key={r} transform={`translate(0 ${134 + r*44})`}>
            <rect x="0" y="0" width="760" height="44" fill={r % 2 ? PALETTE.bg : "#fff"}/>
            <text x="14" y="26" fontFamily="monospace" fontSize="10" fill={PALETTE.text}>DN-{(2026 + r).toString().slice(-4)}</text>
            <text x="139" y="26" fontFamily="sans-serif" fontSize="10" fill={PALETTE.muted}>06/02</text>
            <text x="264" y="26" fontFamily="sans-serif" fontSize="10" fill={PALETTE.text}>Cliente {r+1}</text>
            <rect x="389" y="13" width="80" height="18" rx="9" fill={PALETTE.pink}/>
            <text x="429" y="25" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fill={PALETTE.primary}>Nouvelle</text>
            <text x="589" y="26" fontFamily="sans-serif" fontSize="10" fill={PALETTE.text} fontWeight="bold">{(r+1)*18}500 FCFA</text>
            {/* Facture icons */}
            <circle cx="700" cy="22" r="8" fill={PALETTE.blue}/>
            <circle cx="722" cy="22" r="8" fill={PALETTE.blue}/>
            <circle cx="744" cy="22" r="8" fill={PALETTE.green}/>
          </g>
        ))}
      </g>
    </Chrome>
  ),
  preparation_scan: () => (
    <Chrome title="Préparation">
      <g transform="translate(20 18)">
        <text x="0" y="20" fontFamily="serif" fontSize="20" fill={PALETTE.text}>Préparation · DN-2026</text>
        <rect x="0" y="36" width="760" height="60" rx="8" fill={PALETTE.card} stroke={PALETTE.stroke}/>
        <rect x="14" y="52" width="500" height="28" rx="4" fill={PALETTE.bg}/>
        <text x="26" y="70" fontFamily="monospace" fontSize="11" fill={PALETTE.muted}>Scannez un article…</text>
        <rect x="526" y="52" width="100" height="28" rx="4" fill={PALETTE.primary}/>
        <text x="576" y="70" textAnchor="middle" fontFamily="sans-serif" fontSize="11" fill="#fff" fontWeight="bold">Valider</text>
        {[
          { ok: true, lbl: "Robe Harmattan M Noir" },
          { ok: true, lbl: "Collier Perles" },
          { ok: false, lbl: "Sac à main Rouge" },
          { ok: false, lbl: "Sandales 39 Noir" },
        ].map((it, i) => (
          <g key={i} transform={`translate(0 ${110 + i*58})`}>
            <rect x="0" y="0" width="760" height="48" rx="8" fill={PALETTE.card} stroke={PALETTE.stroke}/>
            {it.ok && <rect x="0" y="0" width="4" height="48" fill={PALETTE.green}/>}
            <rect x="14" y="8" width="32" height="32" rx="4" fill={PALETTE.pink}/>
            <text x="56" y="22" fontFamily="sans-serif" fontSize="11" fill={PALETTE.text}>{it.lbl}</text>
            <text x="56" y="36" fontFamily="sans-serif" fontSize="9" fill={PALETTE.muted}>SKU DN-{200+i} · ×1</text>
            {it.ok ? (
              <g transform="translate(720 24)">
                <circle r="12" fill={PALETTE.green}/>
                <path d="M -5 0 L -1 4 L 6 -4" stroke="#fff" strokeWidth="2.5" fill="none"/>
              </g>
            ) : (
              <g transform="translate(690 10)">
                <rect x="0" y="0" width="60" height="28" rx="4" fill={PALETTE.card} stroke={PALETTE.amber}/>
                <text x="30" y="19" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fill={PALETTE.amber} fontWeight="bold">Manuel</text>
              </g>
            )}
          </g>
        ))}
        <rect x="0" y="440" width="760" height="48" rx="8" fill={PALETTE.primary}/>
        <text x="380" y="470" textAnchor="middle" fontFamily="sans-serif" fontSize="13" fill="#fff" fontWeight="bold">Marquer la commande comme Prête</text>
      </g>
    </Chrome>
  ),
  delivery_day: () => (
    <Chrome title="Journée de livraison">
      <g transform="translate(20 18)">
        <text x="0" y="20" fontFamily="serif" fontSize="20" fill={PALETTE.text}>Journée · 06/02 · Yao</text>
        <g transform="translate(0 36)">
          {["Affectation","Suivi","Réconciliation","Fiches"].map((t, i) => (
            <g key={t} transform={`translate(${i*110} 0)`}>
              <text x="0" y="18" fontFamily="sans-serif" fontSize="11" fill={i === 1 ? PALETTE.primary : PALETTE.muted} fontWeight={i === 1 ? "bold" : "normal"}>{t}</text>
              {i === 1 && <rect x="0" y="24" width="80" height="2" fill={PALETTE.primary}/>}
            </g>
          ))}
        </g>
        <rect x="0" y="76" width="760" height="420" rx="8" fill={PALETTE.card} stroke={PALETTE.stroke}/>
        {/* Fake map background */}
        <rect x="12" y="88" width="736" height="340" rx="6" fill="#e8f1e8"/>
        {[[150,180],[260,230],[420,160],[510,290],[620,220]].map(([x,y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <circle r="7" fill={["#5867fd","#f4b12c","#1f8a4c","#c62828","#0021cc"][i]} stroke="#fff" strokeWidth="2"/>
          </g>
        ))}
        {/* Rider marker */}
        <g transform="translate(340 240)">
          <circle r="15" fill={PALETTE.primary} stroke="#fff" strokeWidth="3"/>
          <text y="4" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fill="#fff" fontWeight="bold">YA</text>
        </g>
        <text x="20" y="455" fontFamily="sans-serif" fontSize="10" fill={PALETTE.muted}>5 commande(s) · 1 livreur en ligne · maj il y a 12 s</text>
      </g>
    </Chrome>
  ),
  dashboard: () => (
    <Chrome title="Tableau de bord">
      <g transform="translate(20 18)">
        <text x="0" y="20" fontFamily="serif" fontSize="20" fill={PALETTE.text}>Tableau de bord</text>
        <rect x="630" y="2" width="130" height="24" rx="12" fill={PALETTE.card} stroke={PALETTE.stroke}/>
        <text x="645" y="18" fontFamily="sans-serif" fontSize="10" fill={PALETTE.text}>Cette semaine ▾</text>
        {[
          { l: "CA période", v: "9,9 M FCFA", c: PALETTE.primary },
          { l: "Commandes", v: "142", c: "#0021cc" },
          { l: "Panier moyen", v: "91,1 k FCFA", c: "#5867fd" },
          { l: "Marge brute", v: "5 M FCFA", c: PALETTE.green },
        ].map((k, i) => (
          <g key={i} transform={`translate(${i*192} 36)`}>
            <rect x="0" y="0" width="178" height="76" rx="8" fill={PALETTE.card} stroke={PALETTE.stroke}/>
            <text x="14" y="22" fontFamily="sans-serif" fontSize="8" fill={PALETTE.muted}>{k.l.toUpperCase()}</text>
            <text x="14" y="56" fontFamily="serif" fontSize="22" fill={k.c} fontWeight="bold">{k.v}</text>
          </g>
        ))}
        <rect x="0" y="124" width="500" height="200" rx="8" fill={PALETTE.card} stroke={PALETTE.stroke}/>
        <text x="14" y="146" fontFamily="serif" fontSize="12" fill={PALETTE.text}>CA & marge par jour</text>
        <polyline points="20,290 90,250 160,260 230,210 300,220 370,180 450,160" fill="none" stroke={PALETTE.primary} strokeWidth="2"/>
        <polyline points="20,310 90,290 160,300 230,260 300,275 370,245 450,225" fill="none" stroke={PALETTE.green} strokeWidth="2"/>
        <rect x="520" y="124" width="240" height="200" rx="8" fill={PALETTE.card} stroke={PALETTE.stroke}/>
        <text x="534" y="146" fontFamily="serif" fontSize="12" fill={PALETTE.text}>Ventes par canal</text>
        <circle cx="640" cy="220" r="55" fill="none" stroke={PALETTE.primary} strokeWidth="18" strokeDasharray="130 300"/>
        <circle cx="640" cy="220" r="55" fill="none" stroke={PALETTE.blue} strokeWidth="18" strokeDasharray="80 300" strokeDashoffset="-130"/>
      </g>
    </Chrome>
  ),
  cash_session: () => (
    <Chrome title="Sessions de caisse">
      <g transform="translate(20 18)">
        <text x="0" y="20" fontFamily="serif" fontSize="20" fill={PALETTE.text}>Session en cours · Aïcha</text>
        {["Sessions 12","À valider 1","Encaissements 2,4 M","Écarts +0 FCFA"].map((t, i) => (
          <g key={i} transform={`translate(${i*192} 36)`}>
            <rect x="0" y="0" width="178" height="60" rx="8" fill={PALETTE.card} stroke={PALETTE.stroke}/>
            <text x="12" y="22" fontFamily="sans-serif" fontSize="8" fill={PALETTE.muted}>{t.split(" ")[0].toUpperCase()}</text>
            <text x="12" y="46" fontFamily="serif" fontSize="18" fill={PALETTE.text} fontWeight="bold">{t.split(" ").slice(1).join(" ")}</text>
          </g>
        ))}
        <rect x="0" y="108" width="760" height="100" rx="10" fill={PALETTE.card} stroke={PALETTE.stroke}/>
        <text x="20" y="134" fontFamily="serif" fontSize="14" fill={PALETTE.text}>Session en cours · ouverte à 08:12</text>
        <rect x="20" y="150" width="180" height="40" rx="6" fill={PALETTE.pink}/>
        <text x="30" y="166" fontFamily="sans-serif" fontSize="8" fill={PALETTE.muted}>FOND INITIAL</text>
        <text x="30" y="184" fontFamily="serif" fontSize="13" fill={PALETTE.text} fontWeight="bold">50 000 FCFA</text>
        <rect x="210" y="150" width="180" height="40" rx="6" fill={PALETTE.pink}/>
        <text x="220" y="166" fontFamily="sans-serif" fontSize="8" fill={PALETTE.muted}>VERSEMENT DÉCLARÉ</text>
        <text x="220" y="184" fontFamily="serif" fontSize="13" fill={PALETTE.blue} fontWeight="bold">240 000 FCFA</text>
        <rect x="560" y="156" width="180" height="36" rx="6" fill={PALETTE.green}/>
        <text x="650" y="179" textAnchor="middle" fontFamily="sans-serif" fontSize="11" fill="#fff" fontWeight="bold">Valider versement</text>
      </g>
    </Chrome>
  ),
};

function Screen({ screen }) {
  const Draw = SCREENS[screen];
  if (!Draw) return <text x="500" y="300" textAnchor="middle" fontSize="18" fill="#999">Mockup indisponible</text>;
  return <Draw/>;
}

export default function AnnotatedScreenshot({ screen = "pos_cart", callouts = [], caption }) {
  return (
    <figure className="rounded-xl overflow-hidden border border-[#ececec] dark:border-[#2a2a2a] bg-[#fafafa] dark:bg-[#141414]" data-testid={`annotated-${screen}`}>
      <svg viewBox="0 0 1000 600" width="100%" height="auto" preserveAspectRatio="xMidYMid meet">
        <Screen screen={screen}/>
        {/* Annotation overlay */}
        {callouts.map((c, i) => {
          const cx = (c.x || 50) * 10;
          const cy = (c.y || 50) * 6;
          return (
            <g key={i}>
              {c.w && c.h && (
                <rect x={cx - (c.w*10)/2} y={cy - (c.h*6)/2} width={c.w*10} height={c.h*6} rx="6"
                      fill="none" stroke="#c62828" strokeWidth="3" strokeDasharray="6 4"/>
              )}
              <circle cx={cx} cy={cy} r="18" fill="#c62828" stroke="#fff" strokeWidth="3"/>
              <text x={cx} y={cy + 5} textAnchor="middle" fontFamily="sans-serif" fontSize="16" fill="#fff" fontWeight="bold">{c.n ?? (i+1)}</text>
              {c.label && (
                <g>
                  <rect x={cx + 24} y={cy - 12} width={Math.max(80, c.label.length * 7)} height="22" rx="4" fill="#1c1c1c"/>
                  <text x={cx + 32} y={cy + 3} fontFamily="sans-serif" fontSize="11" fill="#fff">{c.label}</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
      {caption && <figcaption className="p-2.5 bg-[#fafafa] dark:bg-[#141414] text-xs text-[#666] border-t border-[#ececec] dark:border-[#2a2a2a] italic">{caption}</figcaption>}
    </figure>
  );
}

export const AVAILABLE_SCREENS = Object.keys(SCREENS);
