import React, { useEffect, useState } from "react";
import { Download, Share, PlusSquare, X } from "lucide-react";
import { triggerInstall, canInstall } from "@/lib/sw";
import { isIOS, isStandalone } from "@/components/storefront/InstallGuide";

const isMacSafari = () => /Macintosh/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent) && !/Chrome|Edg/.test(navigator.userAgent) && navigator.maxTouchPoints <= 1;

// Header button: installs the app on Android / Windows / Mac (Chrome, Edge) or shows the iPhone/iPad/Safari steps
export default function AppInstallButton({ appName = "Console" }) {
  const [ready, setReady] = useState(canInstall());
  const [help, setHelp] = useState(false);
  useEffect(() => { const f = () => setReady(canInstall()); window.addEventListener("pwa-install-ready", f); return () => window.removeEventListener("pwa-install-ready", f); }, []);
  if (isStandalone()) return null;
  const ios = isIOS(), mac = isMacSafari();
  if (!ready && !ios && !mac) return null;
  const click = async () => { if (ready) { await triggerInstall(); setReady(canInstall()); } else setHelp(h => !h); };
  return (
    <div className="relative">
      <button onClick={click} className="dina-chip" title={`Installer ${appName} sur cet appareil`} data-testid="app-install-btn"><Download size={12}/><span className="hidden lg:inline">Installer</span></button>
      {help && (
        <div className="absolute right-0 top-9 w-72 max-w-[calc(100vw-1.5rem)] bg-white dark:bg-[#1a1a1a] border border-[#ececec] dark:border-[#2a2a2a] rounded-xl shadow-xl p-3 z-40 text-xs space-y-2" data-testid="app-install-help">
          <div className="flex items-center justify-between font-semibold text-sm">Installer {appName}<button onClick={() => setHelp(false)} aria-label="Fermer" data-testid="app-install-help-close"><X size={14}/></button></div>
          {ios ? (
            <ol className="space-y-1.5 list-decimal pl-4">
              <li>Dans Safari, touchez <Share size={12} className="inline"/> <b>Partager</b></li>
              <li>Choisissez <PlusSquare size={12} className="inline"/> <b>Sur l'écran d'accueil</b></li>
              <li>Touchez <b>Ajouter</b> : l'icône « {appName} » apparaît sur l'écran</li>
            </ol>
          ) : (
            <ol className="space-y-1.5 list-decimal pl-4">
              <li>Dans Safari, ouvrez le menu <b>Fichier</b></li>
              <li>Choisissez <b>Ajouter au Dock</b></li>
              <li>Validez : « {appName} » s'ouvre comme une application</li>
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
