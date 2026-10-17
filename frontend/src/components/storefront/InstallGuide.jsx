import React, { useEffect, useState } from "react";
import { Share, PlusSquare, Download, Smartphone } from "lucide-react";
import { triggerInstall, canInstall } from "@/lib/sw";

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;

/** iPhone: "Add to Home Screen" guide; Android/desktop: install button when the browser offers it. */
export default function InstallGuide({ compact }) {
  const [ready, setReady] = useState(canInstall());
  useEffect(() => { const f = () => setReady(canInstall()); window.addEventListener("pwa-install-ready", f); return () => window.removeEventListener("pwa-install-ready", f); }, []);
  if (isStandalone()) return null;
  if (isIOS()) return (
    <div className="dina-card-white p-4 space-y-2" data-testid="ios-install-guide">
      <div className="flex items-center gap-2 font-semibold text-sm"><Smartphone size={16} className="text-[#b02a2a]"/>Ajouter Chez Dina à l'écran d'accueil</div>
      {!compact && <p className="text-xs text-[#666]">Sur iPhone, Apple n'autorise les notifications qu'une fois le site ajouté à l'écran d'accueil.</p>}
      <ol className="text-xs text-[#444] space-y-1.5">
        <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-[#fde8e8] text-[#b02a2a] grid place-items-center text-[10px] font-bold">1</span>Dans Safari, touchez <Share size={13} className="inline"/> <b>Partager</b> en bas de l'écran</li>
        <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-[#fde8e8] text-[#b02a2a] grid place-items-center text-[10px] font-bold">2</span>Choisissez <PlusSquare size={13} className="inline"/> <b>Sur l'écran d'accueil</b></li>
        <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-[#fde8e8] text-[#b02a2a] grid place-items-center text-[10px] font-bold">3</span>Touchez <b>Ajouter</b>, puis ouvrez Chez Dina depuis l'icône</li>
        <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-[#fde8e8] text-[#b02a2a] grid place-items-center text-[10px] font-bold">4</span>Revenez dans Mon compte › Notifications et touchez <b>Activer</b></li>
      </ol>
    </div>
  );
  if (!ready) return null;
  return (
    <div className="dina-card-white p-4 flex items-center gap-3 flex-wrap" data-testid="pwa-install-card">
      <Smartphone size={18} className="text-[#b02a2a]"/>
      <div className="flex-1 min-w-[180px] text-sm">Installez l'application Chez Dina sur votre téléphone pour un accès en un geste.</div>
      <button onClick={async () => { await triggerInstall(); setReady(canInstall()); }} className="dina-btn-primary !min-h-[36px] text-xs" data-testid="pwa-install-btn"><Download size={13}/>Installer</button>
    </div>
  );
}
