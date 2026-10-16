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
      {["Tableau de bord","Caisse","Commandes","Livraisons","Produits","Clientes","Statistiques"].map((lbl, i) => (
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
    <Chrome title="Commandes · Préparer">
      <g transform="translate(20 18)">
        <text x="0" y="20" fontFamily="serif" fontSize="20" fill={PALETTE.text}>Scan · DN-2026</text>
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
  delivery_riders: () => (
    <Chrome title="Livreurs">
      <g transform="translate(20 18)">
        <text x="0" y="20" fontFamily="serif" fontSize="20" fill={PALETTE.text}>Livreurs — score & tournées</text>
        <rect x="0" y="36" width="760" height="470" rx="8" fill={PALETTE.card} stroke={PALETTE.stroke}/>
        {[
          { n: "Yao", score: 92, ok: 48, ko: 1, color: PALETTE.green },
          { n: "Issa", score: 87, ok: 41, ko: 3, color: PALETTE.green },
          { n: "Fatou", score: 74, ok: 36, ko: 6, color: PALETTE.amber },
          { n: "Moussa", score: 62, ok: 28, ko: 9, color: PALETTE.primary },
        ].map((r, i) => (
          <g key={i} transform={`translate(14 ${54 + i*94})`}>
            <rect x="0" y="0" width="732" height="80" rx="6" fill={PALETTE.bg}/>
            <circle cx="34" cy="40" r="22" fill={PALETTE.pink}/>
            <text x="34" y="45" textAnchor="middle" fontFamily="serif" fontSize="14" fill={PALETTE.primary} fontWeight="bold">{r.n[0]}</text>
            <text x="72" y="30" fontFamily="serif" fontSize="14" fill={PALETTE.text}>{r.n}</text>
            <text x="72" y="48" fontFamily="sans-serif" fontSize="10" fill={PALETTE.muted}>{r.ok} livrées · {r.ko} annulées · retard moy. 7 min</text>
            <rect x="72" y="56" width="200" height="6" rx="3" fill="#eee"/>
            <rect x="72" y="56" width={r.score * 2} height="6" rx="3" fill={r.color}/>
            <text x="640" y="38" fontFamily="serif" fontSize="22" fill={r.color} fontWeight="bold">{r.score}</text>
            <text x="640" y="54" fontFamily="sans-serif" fontSize="9" fill={PALETTE.muted}>/ 100</text>
            <rect x="520" y="44" width="90" height="24" rx="12" fill={i < 2 ? PALETTE.pink : "#fff"} stroke={i < 2 ? PALETTE.primary : PALETTE.stroke}/>
            <text x="565" y="60" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fill={i < 2 ? PALETTE.primary : PALETTE.muted} fontWeight="bold">{i < 2 ? "En ligne" : "Hors ligne"}</text>
          </g>
        ))}
      </g>
    </Chrome>
  ),
  delivery_zones: () => (
    <Chrome title="Zones">
      <g transform="translate(20 18)">
        <text x="0" y="20" fontFamily="serif" fontSize="20" fill={PALETTE.text}>Zones de livraison & tarifs</text>
        <rect x="0" y="36" width="440" height="470" rx="8" fill={PALETTE.card} stroke={PALETTE.stroke}/>
        {[
          { n: "Cocody", p: 1500, slots: 12, c: PALETTE.green },
          { n: "Plateau", p: 2000, slots: 8, c: PALETTE.blue },
          { n: "Yopougon", p: 2500, slots: 6, c: PALETTE.amber },
          { n: "Marcory", p: 2000, slots: 10, c: "#9333ea" },
          { n: "Abobo", p: 3000, slots: 4, c: PALETTE.primary },
        ].map((z, i) => (
          <g key={i} transform={`translate(14 ${54 + i*86})`}>
            <rect x="0" y="0" width="412" height="72" rx="6" fill={PALETTE.bg}/>
            <rect x="0" y="0" width="4" height="72" fill={z.c}/>
            <text x="18" y="26" fontFamily="serif" fontSize="14" fill={PALETTE.text}>{z.n}</text>
            <text x="18" y="46" fontFamily="sans-serif" fontSize="10" fill={PALETTE.muted}>Tarif livraison</text>
            <text x="18" y="62" fontFamily="serif" fontSize="14" fill={z.c} fontWeight="bold">{z.p.toLocaleString()} FCFA</text>
            <text x="300" y="26" fontFamily="sans-serif" fontSize="10" fill={PALETTE.muted}>Créneaux/jour</text>
            <text x="300" y="46" fontFamily="serif" fontSize="22" fill={PALETTE.text} fontWeight="bold">{z.slots}</text>
          </g>
        ))}
        <rect x="454" y="36" width="306" height="470" rx="8" fill="#e8f1e8"/>
        <text x="470" y="60" fontFamily="serif" fontSize="12" fill={PALETTE.text}>Carte Abidjan — zones</text>
        {[[560,120,60,PALETTE.green],[620,200,55,PALETTE.blue],[520,280,50,PALETTE.amber],[640,340,45,"#9333ea"],[550,420,70,PALETTE.primary]].map(([cx,cy,r,c],i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill={c} fillOpacity="0.3" stroke={c} strokeWidth="2"/>
        ))}
      </g>
    </Chrome>
  ),
  products_grid: () => (
    <Chrome title="Produits">
      <g transform="translate(20 18)">
        <text x="0" y="20" fontFamily="serif" fontSize="20" fill={PALETTE.text}>Catalogue · 142 produits</text>
        <rect x="600" y="-2" width="160" height="30" rx="6" fill={PALETTE.primary}/>
        <text x="680" y="17" textAnchor="middle" fontFamily="sans-serif" fontSize="11" fill="#fff" fontWeight="bold">+ Nouveau produit</text>
        <g transform="translate(0 36)">
          {["Robe","Haut","Sac","Bijou","Chaussure","Accessoire"].map((t,i) => (
            <g key={t} transform={`translate(${i*110} 0)`}>
              <rect x="0" y="0" width="100" height="26" rx="13" fill={i===0?PALETTE.pink:"#fff"} stroke={i===0?PALETTE.primary:PALETTE.stroke}/>
              <text x="50" y="18" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fill={i===0?PALETTE.primary:PALETTE.muted} fontWeight={i===0?"bold":"normal"}>{t}</text>
            </g>
          ))}
        </g>
        {[0,1,2,3,4,5,6,7].map(i => (
          <g key={i} transform={`translate(${(i%4)*192} ${86 + Math.floor(i/4)*210})`}>
            <rect x="0" y="0" width="178" height="196" rx="8" fill={PALETTE.card} stroke={PALETTE.stroke}/>
            <rect x="0" y="0" width="178" height="110" rx="8" fill={PALETTE.pink}/>
            <circle cx="156" cy="18" r="10" fill="#fff" stroke={PALETTE.stroke}/>
            <path d={`M 150 18 L 154 22 L 162 14`} stroke={i<3?PALETTE.green:"#ccc"} strokeWidth="2" fill="none"/>
            <text x="12" y="130" fontFamily="serif" fontSize="11" fill={PALETTE.text}>Robe Harmattan {i+1}</text>
            <text x="12" y="146" fontFamily="sans-serif" fontSize="9" fill={PALETTE.muted}>SKU DN-{200+i} · 3 variantes</text>
            <text x="12" y="170" fontFamily="serif" fontSize="14" fill={PALETTE.primary} fontWeight="bold">{(i+1)*15}000 FCFA</text>
            <rect x="120" y="160" width="48" height="22" rx="11" fill={i<5?PALETTE.pink:"#fff"} stroke={i<5?PALETTE.green:PALETTE.amber}/>
            <text x="144" y="174" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fill={i<5?PALETTE.green:PALETTE.amber} fontWeight="bold">{i<5?"Stock":"Rupture"}</text>
          </g>
        ))}
      </g>
    </Chrome>
  ),
  product_variants: () => (
    <Chrome title="Variantes">
      <g transform="translate(20 18)">
        <text x="0" y="20" fontFamily="serif" fontSize="20" fill={PALETTE.text}>Robe Harmattan · Variantes</text>
        <rect x="0" y="36" width="760" height="470" rx="8" fill={PALETTE.card} stroke={PALETTE.stroke}/>
        <text x="20" y="60" fontFamily="serif" fontSize="13" fill={PALETTE.text}>Matrice Taille × Couleur</text>
        {/* Header row */}
        <text x="20" y="100" fontFamily="sans-serif" fontSize="10" fill={PALETTE.muted} fontWeight="bold">COULEUR \ TAILLE</text>
        {["XS","S","M","L","XL"].map((s,i) => (
          <text key={s} x={200 + i*100} y="100" textAnchor="middle" fontFamily="sans-serif" fontSize="11" fill={PALETTE.text} fontWeight="bold">{s}</text>
        ))}
        {/* Color rows */}
        {[
          { name: "Noir", color: "#1c1c1c" },
          { name: "Rouge", color: "#c62828" },
          { name: "Bleu", color: "#5867fd" },
          { name: "Beige", color: "#d4a574" },
        ].map((c, ri) => (
          <g key={ri} transform={`translate(0 ${120 + ri*70})`}>
            <circle cx="30" cy="30" r="10" fill={c.color}/>
            <text x="50" y="34" fontFamily="sans-serif" fontSize="11" fill={PALETTE.text}>{c.name}</text>
            {[0,1,2,3,4].map(ci => {
              const exists = (ri+ci)%3 !== 0;
              const stock = exists ? ((ri+1)*(ci+1)) : 0;
              return (
                <g key={ci} transform={`translate(${160 + ci*100} 0)`}>
                  <rect x="0" y="8" width="80" height="44" rx="6" fill={exists ? (stock<3?PALETTE.pink:PALETTE.bg) : "#f5f5f5"} stroke={exists ? (stock<3?PALETTE.amber:PALETTE.stroke) : "#e5e5e5"} strokeDasharray={exists?"":"4 2"}/>
                  {exists ? (
                    <>
                      <text x="40" y="28" textAnchor="middle" fontFamily="serif" fontSize="16" fill={stock<3?PALETTE.amber:PALETTE.text} fontWeight="bold">{stock}</text>
                      <text x="40" y="44" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fill={PALETTE.muted}>en stock</text>
                    </>
                  ) : (
                    <text x="40" y="34" textAnchor="middle" fontFamily="sans-serif" fontSize="18" fill="#ccc">+</text>
                  )}
                </g>
              );
            })}
          </g>
        ))}
        <rect x="20" y="430" width="200" height="36" rx="6" fill={PALETTE.primary}/>
        <text x="120" y="453" textAnchor="middle" fontFamily="sans-serif" fontSize="11" fill="#fff" fontWeight="bold">Enregistrer</text>
      </g>
    </Chrome>
  ),
  suppliers_po: () => (
    <Chrome title="Fournisseurs">
      <g transform="translate(20 18)">
        <text x="0" y="20" fontFamily="serif" fontSize="20" fill={PALETTE.text}>Commandes fournisseurs · Kanban</text>
        {["Brouillon","Envoyée","Partielle","Réceptionnée"].map((col, ci) => (
          <g key={col} transform={`translate(${ci*192} 44)`}>
            <rect x="0" y="0" width="178" height="460" rx="8" fill={PALETTE.bg}/>
            <text x="14" y="24" fontFamily="sans-serif" fontSize="11" fill={PALETTE.text} fontWeight="bold">{col}</text>
            <rect x="150" y="10" width="20" height="18" rx="9" fill={[PALETTE.muted,PALETTE.blue,PALETTE.amber,PALETTE.green][ci]}/>
            <text x="160" y="23" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fill="#fff" fontWeight="bold">{[2,3,1,8][ci]}</text>
            {[0,1,2].slice(0, [2,3,1,8][ci] > 3 ? 3 : [2,3,1,8][ci]).map(ri => (
              <g key={ri} transform={`translate(8 ${44 + ri*96})`}>
                <rect x="0" y="0" width="162" height="86" rx="6" fill={PALETTE.card} stroke={PALETTE.stroke}/>
                <text x="10" y="20" fontFamily="monospace" fontSize="10" fill={PALETTE.primary} fontWeight="bold">BC-20{ci}{ri}</text>
                <text x="10" y="36" fontFamily="sans-serif" fontSize="10" fill={PALETTE.text}>Boutique Bamako</text>
                <text x="10" y="52" fontFamily="sans-serif" fontSize="9" fill={PALETTE.muted}>12 articles</text>
                <text x="10" y="72" fontFamily="serif" fontSize="12" fill={PALETTE.text} fontWeight="bold">{(ri+1)*450}k FCFA</text>
              </g>
            ))}
          </g>
        ))}
      </g>
    </Chrome>
  ),
  stock_list: () => (
    <Chrome title="Stock">
      <g transform="translate(20 18)">
        <text x="0" y="20" fontFamily="serif" fontSize="20" fill={PALETTE.text}>Stock & alertes</text>
        {["Total 1 240","Ruptures 8","Faibles 23","Valeur 42 M"].map((k, i) => (
          <g key={i} transform={`translate(${i*192} 36)`}>
            <rect x="0" y="0" width="178" height="60" rx="8" fill={PALETTE.card} stroke={PALETTE.stroke}/>
            <text x="12" y="22" fontFamily="sans-serif" fontSize="8" fill={PALETTE.muted}>{k.split(" ")[0].toUpperCase()}</text>
            <text x="12" y="46" fontFamily="serif" fontSize="18" fill={i===1?PALETTE.primary:i===2?PALETTE.amber:PALETTE.text} fontWeight="bold">{k.split(" ").slice(1).join(" ")}</text>
          </g>
        ))}
        <rect x="0" y="108" width="760" height="400" rx="8" fill={PALETTE.card} stroke={PALETTE.stroke}/>
        <rect x="0" y="108" width="760" height="30" fill={PALETTE.bg}/>
        {["SKU","Produit","Variante","Stock","Seuil","Action"].map((h,i) => (
          <text key={h} x={14 + i*125} y="128" fontFamily="sans-serif" fontSize="9" fill={PALETTE.muted} fontWeight="bold">{h.toUpperCase()}</text>
        ))}
        {[
          { stock: 0, alert: "rupture", color: PALETTE.primary },
          { stock: 2, alert: "faible", color: PALETTE.amber },
          { stock: 15, alert: "ok", color: PALETTE.green },
          { stock: 1, alert: "faible", color: PALETTE.amber },
          { stock: 42, alert: "ok", color: PALETTE.green },
        ].map((r, ri) => (
          <g key={ri} transform={`translate(0 ${138 + ri*52})`}>
            <rect x="0" y="0" width="760" height="52" fill={ri%2?PALETTE.bg:"#fff"}/>
            <text x="14" y="30" fontFamily="monospace" fontSize="10" fill={PALETTE.text}>DN-{200+ri}</text>
            <text x="139" y="30" fontFamily="sans-serif" fontSize="10" fill={PALETTE.text}>Robe Harmattan {ri+1}</text>
            <text x="264" y="30" fontFamily="sans-serif" fontSize="10" fill={PALETTE.muted}>M · Noir</text>
            <text x="389" y="30" fontFamily="serif" fontSize="14" fill={r.color} fontWeight="bold">{r.stock}</text>
            <text x="514" y="30" fontFamily="sans-serif" fontSize="10" fill={PALETTE.muted}>5</text>
            <rect x="634" y="16" width="110" height="22" rx="4" fill={r.alert === "ok" ? PALETTE.bg : PALETTE.primary}/>
            <text x="689" y="30" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fill={r.alert === "ok" ? PALETTE.muted : "#fff"} fontWeight="bold">{r.alert === "ok" ? "—" : "Réapprovisionner"}</text>
          </g>
        ))}
      </g>
    </Chrome>
  ),
  customers_list: () => (
    <Chrome title="Clientes">
      <g transform="translate(20 18)">
        <text x="0" y="20" fontFamily="serif" fontSize="20" fill={PALETTE.text}>Clientes · 1 248 fiches</text>
        {["VIP 48","Fidèles 220","Nouvelles 86","Inactives 42"].map((k, i) => (
          <g key={i} transform={`translate(${i*192} 36)`}>
            <rect x="0" y="0" width="178" height="60" rx="8" fill={PALETTE.card} stroke={PALETTE.stroke}/>
            <text x="12" y="22" fontFamily="sans-serif" fontSize="8" fill={[PALETTE.primary,PALETTE.blue,PALETTE.green,PALETTE.muted][i]} fontWeight="bold">{k.split(" ")[0].toUpperCase()}</text>
            <text x="12" y="46" fontFamily="serif" fontSize="18" fill={PALETTE.text} fontWeight="bold">{k.split(" ")[1]}</text>
          </g>
        ))}
        <rect x="0" y="108" width="760" height="400" rx="8" fill={PALETTE.card} stroke={PALETTE.stroke}/>
        {[
          { n: "Awa Koné", s: "VIP", c: PALETTE.primary, orders: 24, loyalty: 1200 },
          { n: "Fatou Diallo", s: "Fidèle", c: PALETTE.blue, orders: 12, loyalty: 480 },
          { n: "Aïssatou Sow", s: "Nouvelle", c: PALETTE.green, orders: 2, loyalty: 50 },
          { n: "Mariam Touré", s: "VIP", c: PALETTE.primary, orders: 31, loyalty: 1800 },
          { n: "Nafi Camara", s: "Fidèle", c: PALETTE.blue, orders: 9, loyalty: 320 },
        ].map((c, ri) => (
          <g key={ri} transform={`translate(14 ${124 + ri*72})`}>
            <rect x="0" y="0" width="732" height="60" rx="6" fill={PALETTE.bg}/>
            <circle cx="34" cy="30" r="20" fill={PALETTE.pink}/>
            <text x="34" y="35" textAnchor="middle" fontFamily="serif" fontSize="13" fill={PALETTE.primary} fontWeight="bold">{c.n[0]}</text>
            <text x="68" y="26" fontFamily="serif" fontSize="13" fill={PALETTE.text}>{c.n}</text>
            <text x="68" y="42" fontFamily="sans-serif" fontSize="10" fill={PALETTE.muted}>{c.orders} commandes · dernière le 02/02</text>
            <rect x="340" y="18" width="70" height="24" rx="12" fill={c.c} fillOpacity="0.15"/>
            <text x="375" y="34" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fill={c.c} fontWeight="bold">{c.s}</text>
            <text x="500" y="26" fontFamily="sans-serif" fontSize="9" fill={PALETTE.muted}>FIDÉLITÉ</text>
            <text x="500" y="42" fontFamily="serif" fontSize="13" fill={PALETTE.text} fontWeight="bold">{c.loyalty} pts</text>
            <rect x="640" y="18" width="80" height="24" rx="4" fill={PALETTE.primary}/>
            <text x="680" y="34" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fill="#fff" fontWeight="bold">WhatsApp</text>
          </g>
        ))}
      </g>
    </Chrome>
  ),
  promo_codes: () => (
    <Chrome title="Promotions">
      <g transform="translate(20 18)">
        <text x="0" y="20" fontFamily="serif" fontSize="20" fill={PALETTE.text}>Promotions & fidélité</text>
        <rect x="0" y="36" width="500" height="470" rx="8" fill={PALETTE.card} stroke={PALETTE.stroke}/>
        <text x="20" y="60" fontFamily="serif" fontSize="14" fill={PALETTE.text}>Codes promo actifs</text>
        {[
          { code: "HARMATTAN20", disc: "-20%", used: 142, max: 500 },
          { code: "BIENVENUE10", disc: "-10%", used: 86, max: 200 },
          { code: "FIDELE5K", disc: "-5 000 FCFA", used: 24, max: 100 },
        ].map((p, i) => (
          <g key={i} transform={`translate(20 ${80 + i*96})`}>
            <rect x="0" y="0" width="460" height="80" rx="6" fill={PALETTE.bg}/>
            <rect x="0" y="0" width="4" height="80" fill={PALETTE.primary}/>
            <text x="18" y="26" fontFamily="monospace" fontSize="13" fill={PALETTE.primary} fontWeight="bold">{p.code}</text>
            <text x="18" y="46" fontFamily="serif" fontSize="18" fill={PALETTE.text} fontWeight="bold">{p.disc}</text>
            <text x="18" y="66" fontFamily="sans-serif" fontSize="10" fill={PALETTE.muted}>{p.used} / {p.max} utilisations</text>
            <rect x="200" y="60" width="240" height="6" rx="3" fill="#eee"/>
            <rect x="200" y="60" width={(p.used/p.max)*240} height="6" rx="3" fill={PALETTE.green}/>
            <rect x="380" y="20" width="70" height="24" rx="12" fill={PALETTE.green} fillOpacity="0.15"/>
            <text x="415" y="36" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fill={PALETTE.green} fontWeight="bold">Actif</text>
          </g>
        ))}
        <rect x="516" y="36" width="244" height="470" rx="8" fill={PALETTE.card} stroke={PALETTE.stroke}/>
        <text x="536" y="60" fontFamily="serif" fontSize="14" fill={PALETTE.text}>Fidélité</text>
        <text x="536" y="90" fontFamily="sans-serif" fontSize="10" fill={PALETTE.muted}>1 point / 1 000 FCFA dépensé</text>
        <rect x="536" y="104" width="208" height="60" rx="6" fill={PALETTE.pink}/>
        <text x="546" y="122" fontFamily="sans-serif" fontSize="8" fill={PALETTE.muted}>SEUIL VIP</text>
        <text x="546" y="150" fontFamily="serif" fontSize="20" fill={PALETTE.primary} fontWeight="bold">1 000 pts</text>
        <text x="536" y="200" fontFamily="serif" fontSize="12" fill={PALETTE.text}>Parrainage</text>
        <text x="536" y="222" fontFamily="sans-serif" fontSize="10" fill={PALETTE.muted}>Marraine : -10% · Filleule : -5%</text>
        <rect x="536" y="430" width="208" height="40" rx="6" fill={PALETTE.primary}/>
        <text x="640" y="455" textAnchor="middle" fontFamily="sans-serif" fontSize="11" fill="#fff" fontWeight="bold">Nouveau code</text>
      </g>
    </Chrome>
  ),
  stats_tabs: () => (
    <Chrome title="Statistiques">
      <g transform="translate(20 18)">
        <text x="0" y="20" fontFamily="serif" fontSize="20" fill={PALETTE.text}>Statistiques · 12 onglets</text>
        <g transform="translate(0 36)">
          {["Résumé","CA","Marge","Produits","Clientes","Livraison","Dépenses"].map((t,i) => (
            <g key={t} transform={`translate(${i*108} 0)`}>
              <text x="0" y="18" fontFamily="sans-serif" fontSize="11" fill={i===0?PALETTE.primary:PALETTE.muted} fontWeight={i===0?"bold":"normal"}>{t}</text>
              {i===0 && <rect x="0" y="24" width="60" height="2" fill={PALETTE.primary}/>}
            </g>
          ))}
        </g>
        <rect x="0" y="60" width="372" height="200" rx="8" fill={PALETTE.card} stroke={PALETTE.stroke}/>
        <text x="14" y="82" fontFamily="serif" fontSize="12" fill={PALETTE.text}>CA par semaine</text>
        {[0,1,2,3,4,5,6].map(i => (
          <rect key={i} x={30 + i*48} y={240 - (30 + i*15 + (i%2)*20)} width="32" height={30 + i*15 + (i%2)*20} fill={PALETTE.primary} fillOpacity={0.4 + i*0.08}/>
        ))}
        <rect x="388" y="60" width="372" height="200" rx="8" fill={PALETTE.card} stroke={PALETTE.stroke}/>
        <text x="402" y="82" fontFamily="serif" fontSize="12" fill={PALETTE.text}>Top produits · marge</text>
        {[0,1,2,3,4].map(i => (
          <g key={i} transform={`translate(402 ${100 + i*28})`}>
            <text x="0" y="12" fontFamily="sans-serif" fontSize="10" fill={PALETTE.text}>Robe Harmattan {i+1}</text>
            <rect x="140" y="4" width={180 - i*20} height="12" rx="2" fill={PALETTE.green}/>
            <text x="330" y="14" textAnchor="end" fontFamily="sans-serif" fontSize="10" fill={PALETTE.text} fontWeight="bold">{(5-i)*180}k</text>
          </g>
        ))}
        <rect x="0" y="276" width="760" height="228" rx="8" fill={PALETTE.card} stroke={PALETTE.stroke}/>
        <text x="14" y="298" fontFamily="serif" fontSize="12" fill={PALETTE.text}>Compte de résultat (mois)</text>
        {[
          { l: "Chiffre d'affaires", v: "+ 42 500 000", c: PALETTE.text },
          { l: "Coût marchandises", v: "− 22 100 000", c: PALETTE.text },
          { l: "Marge brute", v: "20 400 000", c: PALETTE.green },
          { l: "Dépenses d'exploitation", v: "− 8 300 000", c: PALETTE.text },
          { l: "Résultat net", v: "12 100 000 FCFA", c: PALETTE.primary },
        ].map((r, ri) => (
          <g key={ri} transform={`translate(14 ${320 + ri*32})`}>
            <text x="0" y="18" fontFamily="sans-serif" fontSize="11" fill={PALETTE.muted}>{r.l}</text>
            <text x="730" y="18" textAnchor="end" fontFamily="serif" fontSize="13" fill={r.c} fontWeight={ri===4?"bold":"normal"}>{r.v}</text>
            {ri===4 && <line x1="400" y1="4" x2="730" y2="4" stroke={PALETTE.stroke}/>}
          </g>
        ))}
      </g>
    </Chrome>
  ),
  cms_pages: () => (
    <Chrome title="Site vitrine">
      <g transform="translate(20 18)">
        <text x="0" y="20" fontFamily="serif" fontSize="20" fill={PALETTE.text}>Site vitrine · pages & apparence</text>
        <rect x="0" y="36" width="300" height="470" rx="8" fill={PALETTE.card} stroke={PALETTE.stroke}/>
        <text x="20" y="60" fontFamily="serif" fontSize="12" fill={PALETTE.text}>Pages</text>
        {[
          { n: "Accueil", slug: "/", st: "Publié" },
          { n: "Nouveautés", slug: "/nouveautes", st: "Publié" },
          { n: "À propos", slug: "/a-propos", st: "Publié" },
          { n: "CGV", slug: "/cgv", st: "Brouillon" },
          { n: "FAQ", slug: "/faq", st: "Publié" },
        ].map((p, i) => (
          <g key={i} transform={`translate(14 ${76 + i*54})`}>
            <rect x="0" y="0" width="272" height="44" rx="6" fill={i===0?PALETTE.pink:PALETTE.bg}/>
            <text x="14" y="20" fontFamily="serif" fontSize="12" fill={PALETTE.text}>{p.n}</text>
            <text x="14" y="36" fontFamily="monospace" fontSize="9" fill={PALETTE.muted}>{p.slug}</text>
            <rect x="180" y="12" width="78" height="20" rx="10" fill={p.st==="Publié"?PALETTE.green:PALETTE.amber} fillOpacity="0.15"/>
            <text x="219" y="26" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fill={p.st==="Publié"?PALETTE.green:PALETTE.amber} fontWeight="bold">{p.st}</text>
          </g>
        ))}
        <rect x="316" y="36" width="444" height="470" rx="8" fill={PALETTE.card} stroke={PALETTE.stroke}/>
        <text x="336" y="60" fontFamily="serif" fontSize="12" fill={PALETTE.text}>Aperçu · Accueil</text>
        <rect x="336" y="76" width="408" height="100" rx="6" fill="#1c1c1c"/>
        <text x="356" y="110" fontFamily="serif" fontSize="18" fill="#fff">Chez Dina</text>
        <text x="356" y="130" fontFamily="serif" fontSize="12" fill={PALETTE.pink}>Mode féminine · Abidjan</text>
        <rect x="356" y="144" width="100" height="22" rx="11" fill={PALETTE.primary}/>
        <text x="406" y="159" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fill="#fff" fontWeight="bold">Découvrir</text>
        {[0,1,2].map(i => (
          <g key={i} transform={`translate(${336 + i*140} 190)`}>
            <rect x="0" y="0" width="128" height="130" rx="6" fill={PALETTE.pink}/>
            <text x="64" y="155" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fill={PALETTE.text}>Produit {i+1}</text>
          </g>
        ))}
        <rect x="336" y="340" width="408" height="60" rx="6" fill={PALETTE.bg}/>
        <text x="356" y="362" fontFamily="serif" fontSize="11" fill={PALETTE.text}>Horaires d'ouverture</text>
        <text x="356" y="382" fontFamily="sans-serif" fontSize="10" fill={PALETTE.muted}>Lun-Sam 09:00 → 19:00 · Dim fermé</text>
        <rect x="336" y="420" width="408" height="60" rx="6" fill={PALETTE.pink}/>
        <text x="540" y="455" textAnchor="middle" fontFamily="serif" fontSize="12" fill={PALETTE.primary} fontWeight="bold">Rejoignez-nous sur WhatsApp</text>
      </g>
    </Chrome>
  ),
  attendance_kiosk: () => (
    <Chrome title="Pointage · Kiosk">
      <g transform="translate(20 18)">
        <text x="0" y="20" fontFamily="serif" fontSize="20" fill={PALETTE.text}>Pointage · Tablette boutique</text>
        <rect x="0" y="36" width="400" height="470" rx="12" fill="#1c1c1c"/>
        <text x="200" y="80" textAnchor="middle" fontFamily="serif" fontSize="18" fill="#fff">Bonjour !</text>
        <text x="200" y="104" textAnchor="middle" fontFamily="sans-serif" fontSize="11" fill={PALETTE.muted}>Entrez votre code à 4 chiffres</text>
        {/* Big action buttons */}
        <g transform="translate(40 130)">
          <rect x="0" y="0" width="150" height="60" rx="30" fill={PALETTE.green}/>
          <text x="75" y="38" textAnchor="middle" fontFamily="serif" fontSize="16" fill="#fff" fontWeight="bold">Arrivée</text>
        </g>
        <g transform="translate(210 130)">
          <rect x="0" y="0" width="150" height="60" rx="30" fill="#fff" stroke="#555"/>
          <text x="75" y="38" textAnchor="middle" fontFamily="serif" fontSize="16" fill="#555" fontWeight="bold">Départ</text>
        </g>
        {/* PIN pad */}
        <g transform="translate(80 210)">
          {[1,2,3,4,5,6,7,8,9].map((n,i) => (
            <g key={n} transform={`translate(${(i%3)*80} ${Math.floor(i/3)*72})`}>
              <circle cx="30" cy="30" r="28" fill="#2a2a2a" stroke="#444"/>
              <text x="30" y="38" textAnchor="middle" fontFamily="serif" fontSize="20" fill="#fff">{n}</text>
            </g>
          ))}
          <g transform={`translate(80 216)`}>
            <circle cx="30" cy="30" r="28" fill="#2a2a2a" stroke="#444"/>
            <text x="30" y="38" textAnchor="middle" fontFamily="serif" fontSize="20" fill="#fff">0</text>
          </g>
        </g>
        {/* Right panel - today's attendance */}
        <rect x="416" y="36" width="344" height="470" rx="8" fill={PALETTE.card} stroke={PALETTE.stroke}/>
        <text x="436" y="60" fontFamily="serif" fontSize="14" fill={PALETTE.text}>Présences du jour</text>
        {[
          { n: "Aïcha", in: "08:12", out: "—", color: PALETTE.green },
          { n: "Fatou", in: "08:48", out: "—", color: PALETTE.green },
          { n: "Mariam", in: "09:14", out: "17:02", color: PALETTE.muted },
          { n: "Yao (livreur)", in: "07:55", out: "—", color: PALETTE.green },
        ].map((p, i) => (
          <g key={i} transform={`translate(436 ${80 + i*68})`}>
            <rect x="0" y="0" width="304" height="56" rx="6" fill={PALETTE.bg}/>
            <circle cx="22" cy="28" r="4" fill={p.color}/>
            <text x="38" y="24" fontFamily="serif" fontSize="12" fill={PALETTE.text}>{p.n}</text>
            <text x="38" y="42" fontFamily="sans-serif" fontSize="10" fill={PALETTE.muted}>In {p.in} · Out {p.out}</text>
            <rect x="240" y="14" width="54" height="28" rx="4" fill="#fff" stroke={PALETTE.stroke}/>
            <text x="267" y="32" textAnchor="middle" fontFamily="sans-serif" fontSize="14">📷</text>
          </g>
        ))}
      </g>
    </Chrome>
  ),
  settings_identity: () => (
    <Chrome title="Paramètres">
      <g transform="translate(20 18)">
        <text x="0" y="20" fontFamily="serif" fontSize="20" fill={PALETTE.text}>Paramètres · Identité & horaires</text>
        <rect x="0" y="36" width="200" height="470" rx="8" fill={PALETTE.card} stroke={PALETTE.stroke}/>
        {["Identité","Coordonnées","Horaires","Paiements","Notifications","Intégrations"].map((t,i) => (
          <g key={t} transform={`translate(10 ${50 + i*44})`}>
            <rect x="0" y="0" width="180" height="36" rx="6" fill={i<=2?PALETTE.pink:"transparent"}/>
            <text x="12" y="22" fontFamily="sans-serif" fontSize="11" fill={i<=2?PALETTE.primary:PALETTE.text} fontWeight={i===0?"bold":"normal"}>{t}</text>
          </g>
        ))}
        <rect x="216" y="36" width="544" height="470" rx="8" fill={PALETTE.card} stroke={PALETTE.stroke}/>
        <text x="236" y="60" fontFamily="serif" fontSize="14" fill={PALETTE.text}>Logo & nom de la boutique</text>
        <rect x="236" y="76" width="120" height="120" rx="6" fill={PALETTE.pink}/>
        <text x="296" y="138" textAnchor="middle" fontFamily="serif" fontSize="22" fill={PALETTE.primary} fontWeight="bold">CD</text>
        <text x="296" y="162" textAnchor="middle" fontFamily="serif" fontSize="11" fill={PALETTE.primary}>Chez Dina</text>
        <rect x="236" y="206" width="200" height="30" rx="4" fill={PALETTE.primary}/>
        <text x="336" y="226" textAnchor="middle" fontFamily="sans-serif" fontSize="11" fill="#fff" fontWeight="bold">Remplacer le logo</text>
        <text x="376" y="100" fontFamily="sans-serif" fontSize="10" fill={PALETTE.muted}>Nom affiché partout</text>
        <rect x="376" y="110" width="364" height="30" rx="4" fill={PALETTE.bg} stroke={PALETTE.stroke}/>
        <text x="388" y="130" fontFamily="serif" fontSize="12" fill={PALETTE.text}>Chez Dina</text>
        <text x="376" y="158" fontFamily="sans-serif" fontSize="10" fill={PALETTE.muted}>Baseline</text>
        <rect x="376" y="168" width="364" height="30" rx="4" fill={PALETTE.bg} stroke={PALETTE.stroke}/>
        <text x="388" y="188" fontFamily="sans-serif" fontSize="11" fill={PALETTE.muted}>Mode féminine · Abidjan</text>
        <text x="236" y="270" fontFamily="serif" fontSize="14" fill={PALETTE.text}>Horaires d'ouverture (visibles sur la vitrine)</text>
        {[
          { d: "Lundi", h: "09:00 → 19:00", open: true },
          { d: "Mardi", h: "09:00 → 19:00", open: true },
          { d: "Mercredi", h: "09:00 → 19:00", open: true },
          { d: "Jeudi", h: "09:00 → 19:00", open: true },
          { d: "Vendredi", h: "09:00 → 20:00", open: true },
          { d: "Samedi", h: "10:00 → 20:00", open: true },
          { d: "Dimanche", h: "Fermé", open: false },
        ].map((row, i) => (
          <g key={i} transform={`translate(236 ${290 + i*26})`}>
            <rect x="0" y="0" width="504" height="22" rx="4" fill={i%2?PALETTE.bg:"#fff"}/>
            <circle cx="12" cy="11" r="4" fill={row.open?PALETTE.green:PALETTE.muted}/>
            <text x="24" y="15" fontFamily="sans-serif" fontSize="10" fill={PALETTE.text}>{row.d}</text>
            <text x="140" y="15" fontFamily="monospace" fontSize="10" fill={row.open?PALETTE.text:PALETTE.muted}>{row.h}</text>
            <rect x="440" y="2" width="54" height="18" rx="9" fill={row.open?PALETTE.green:"#eee"}/>
            <text x="467" y="14" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fill={row.open?"#fff":PALETTE.muted} fontWeight="bold">{row.open?"Ouvert":"Fermé"}</text>
          </g>
        ))}
      </g>
    </Chrome>
  ),
  rider_app: () => (
    <>
      {/* Phone frame */}
      <rect x="0" y="0" width="1000" height="600" fill={PALETTE.bg}/>
      <rect x="340" y="30" width="320" height="540" rx="36" fill="#1c1c1c"/>
      <rect x="356" y="60" width="288" height="480" rx="12" fill="#fff"/>
      {/* App header */}
      <rect x="356" y="60" width="288" height="60" rx="12" fill={PALETTE.primary}/>
      <text x="500" y="88" textAnchor="middle" fontFamily="serif" fontSize="15" fill="#fff">Chez Dina · Livreur</text>
      <text x="500" y="106" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fill={PALETTE.pink}>Yao · Journée 06/02</text>
      {/* Stats row */}
      <g transform="translate(370 130)">
        {[{l:"Livrées",v:"8",c:PALETTE.green},{l:"À faire",v:"3",c:PALETTE.amber},{l:"Score",v:"92",c:PALETTE.primary}].map((s,i)=>(
          <g key={i} transform={`translate(${i*86} 0)`}>
            <rect x="0" y="0" width="80" height="60" rx="8" fill={PALETTE.bg}/>
            <text x="40" y="22" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fill={PALETTE.muted}>{s.l.toUpperCase()}</text>
            <text x="40" y="48" textAnchor="middle" fontFamily="serif" fontSize="20" fill={s.c} fontWeight="bold">{s.v}</text>
          </g>
        ))}
      </g>
      {/* Delivery cards */}
      {[
        { c: "DN-2026", client: "Awa K.", zone: "Cocody", status: "À livrer", color: PALETTE.amber },
        { c: "DN-2027", client: "Fatou D.", zone: "Plateau", status: "En route", color: PALETTE.blue },
        { c: "DN-2028", client: "Nafi C.", zone: "Marcory", status: "À livrer", color: PALETTE.amber },
      ].map((d, i) => (
        <g key={i} transform={`translate(370 ${210 + i*100})`}>
          <rect x="0" y="0" width="252" height="88" rx="8" fill="#fff" stroke={PALETTE.stroke}/>
          <rect x="0" y="0" width="4" height="88" fill={d.color}/>
          <text x="14" y="22" fontFamily="monospace" fontSize="11" fill={PALETTE.primary} fontWeight="bold">{d.c}</text>
          <text x="14" y="42" fontFamily="serif" fontSize="13" fill={PALETTE.text}>{d.client}</text>
          <text x="14" y="58" fontFamily="sans-serif" fontSize="10" fill={PALETTE.muted}>{d.zone} · 18 500 FCFA · COD</text>
          <rect x="14" y="64" width="60" height="18" rx="9" fill={d.color} fillOpacity="0.15"/>
          <text x="44" y="76" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fill={d.color} fontWeight="bold">{d.status}</text>
          <rect x="178" y="30" width="60" height="28" rx="14" fill={PALETTE.green}/>
          <text x="208" y="48" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fill="#fff" fontWeight="bold">Appeler</text>
          <rect x="178" y="60" width="60" height="20" rx="4" fill={PALETTE.primary}/>
          <text x="208" y="74" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fill="#fff" fontWeight="bold">Preuve</text>
        </g>
      ))}
      <text x="500" y="580" textAnchor="middle" fontFamily="serif" fontSize="12" fill={PALETTE.muted}>Espace livreur · téléphone</text>
    </>
  ),
  approvals_inbox: () => (
    <Chrome title="À approuver">
      <g transform="translate(20 18)">
        <text x="0" y="20" fontFamily="serif" fontSize="20" fill={PALETTE.text}>À approuver · 7 demandes</text>
        <rect x="0" y="36" width="760" height="470" rx="8" fill={PALETTE.card} stroke={PALETTE.stroke}/>
        {[
          { t: "Remise exceptionnelle", by: "Aïcha · Caissière", a: "−15% sur DN-2026", urgent: true },
          { t: "Override préparation", by: "Fatou · Prépa", a: "SKU DN-203 non scanné", urgent: false },
          { t: "Remboursement", by: "Mariam · Gérante", a: "25 000 FCFA · motif retour", urgent: true },
          { t: "Dépense exceptionnelle", by: "Awa · Admin", a: "42 000 FCFA · transport fournisseur", urgent: false },
          { t: "Ouverture caisse avec écart", by: "Fatou · Caisse", a: "Fond attendu 50k, saisi 48k", urgent: false },
        ].map((r, i) => (
          <g key={i} transform={`translate(14 ${54 + i*86})`}>
            <rect x="0" y="0" width="732" height="76" rx="6" fill={r.urgent?PALETTE.pink:PALETTE.bg}/>
            {r.urgent && <rect x="0" y="0" width="4" height="76" fill={PALETTE.primary}/>}
            <text x="18" y="24" fontFamily="serif" fontSize="13" fill={PALETTE.text} fontWeight="bold">{r.t}</text>
            {r.urgent && (
              <>
                <rect x="200" y="12" width="54" height="20" rx="10" fill={PALETTE.primary}/>
                <text x="227" y="26" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fill="#fff" fontWeight="bold">Urgent</text>
              </>
            )}
            <text x="18" y="42" fontFamily="sans-serif" fontSize="10" fill={PALETTE.muted}>Demandé par {r.by}</text>
            <text x="18" y="60" fontFamily="sans-serif" fontSize="11" fill={PALETTE.text}>{r.a}</text>
            <rect x="520" y="24" width="90" height="30" rx="4" fill={PALETTE.green}/>
            <text x="565" y="43" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fill="#fff" fontWeight="bold">Approuver</text>
            <rect x="618" y="24" width="90" height="30" rx="4" fill="#fff" stroke={PALETTE.primary}/>
            <text x="663" y="43" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fill={PALETTE.primary} fontWeight="bold">Rejeter</text>
          </g>
        ))}
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
