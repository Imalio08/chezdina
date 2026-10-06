import React, { useEffect, useRef } from "react";
import { X, ScanLine } from "lucide-react";
import { toast } from "sonner";

/** POS Scanner — html5-qrcode continuous mode with camera. */
export default function PosScanner({ onScan, onClose }) {
  const containerRef = useRef(null);
  const scannerRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const divId = "pos-scanner-area";
        if (!mounted) return;
        const scanner = new Html5Qrcode(divId, { verbose: false });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 180 } },
          (text) => {
            try { new Audio("data:audio/wav;base64,UklGRnoAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVYAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==").play().catch(()=>{}); } catch {}
            onScan(text);
          },
          () => {}
        );
      } catch (e) {
        toast.error("Caméra inaccessible — vérifiez les permissions");
        console.error(e);
      }
    })();
    return () => {
      mounted = false;
      if (scannerRef.current) { try { scannerRef.current.stop().then(()=>scannerRef.current.clear()); } catch {} }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-black/80 grid place-items-center z-[60] p-4" data-testid="pos-scanner-modal">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-5 w-full max-w-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-[#fff5f5] text-[#b02a2a] grid place-items-center"><ScanLine size={14}/></div><div><div className="font-serif text-lg">Scanner continu</div><div className="text-xs text-[#666]">Pointez un QR ou code-barres</div></div></div>
          <button onClick={onClose}><X size={18}/></button>
        </div>
        <div id="pos-scanner-area" ref={containerRef} className="w-full aspect-video bg-black rounded-lg overflow-hidden"></div>
        <div className="text-xs text-[#666] mt-3 text-center">Un bip retentit à chaque code reconnu · article ajouté au panier</div>
      </div>
    </div>
  );
}
