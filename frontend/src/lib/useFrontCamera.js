import { useCallback, useEffect, useRef, useState } from "react";

const camMessage = (e) => {
  const n = e?.name || "";
  if (n === "NotAllowedError" || n === "SecurityError" || n === "PermissionDeniedError")
    return "Accès à la caméra refusé. Pour pointer, autorisez la caméra : sur iPhone, Réglages › Safari (ou votre navigateur) › Caméra › Autoriser ; sur Android, touchez le cadenas à côté de l'adresse › Autorisations › Caméra › Autoriser. Puis touchez « Réessayer ».";
  if (n === "NotFoundError" || n === "DevicesNotFoundError") return "Aucune caméra détectée sur cet appareil.";
  if (n === "NotReadableError" || n === "TrackStartError" || n === "AbortError") return "La caméra est utilisée par une autre application. Fermez-la puis touchez « Réessayer ».";
  return "Impossible d'ouvrir la caméra. Touchez « Réessayer ».";
};

/** Front camera with a callback ref: the stream is (re)attached whenever the <video> mounts (iOS/Android safe). */
export function useFrontCamera() {
  const streamRef = useRef(null);
  const videoEl = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  const attach = useCallback((v) => {
    videoEl.current = v;
    const s = streamRef.current;
    if (!v || !s) return;
    if (v.srcObject !== s) v.srcObject = s;
    v.muted = true; v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", ""); v.setAttribute("autoplay", "");
    v.onplaying = () => setReady(true);
    v.onloadedmetadata = () => { v.play().catch(() => {}); };
    v.play().catch(() => {});
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoEl.current) videoEl.current.srcObject = null;
    setReady(false);
  }, []);

  const start = useCallback(async () => {
    stop(); setError(""); setStarting(true);
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError("La caméra n'est pas disponible dans ce navigateur. Ouvrez l'application dans Safari (iPhone) ou Chrome (Android).");
        return;
      }
      const tries = [
        { video: { facingMode: { ideal: "user" }, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
        { video: { facingMode: "user" }, audio: false },
        { video: true, audio: false },
      ];
      let s = null; let err = null;
      for (const c of tries) {
        try { s = await navigator.mediaDevices.getUserMedia(c); break; }
        catch (e) { err = e; if (["NotAllowedError", "SecurityError", "PermissionDeniedError"].includes(e?.name)) break; }
      }
      if (!s) { setError(camMessage(err)); return; }
      streamRef.current = s;
      attach(videoEl.current);
    } finally { setStarting(false); }
  }, [attach, stop]);

  const capture = useCallback(() => {
    const v = videoEl.current;
    if (!v || !v.videoWidth) return null;
    const W = 480, H = 360, c = document.createElement("canvas");
    c.width = W; c.height = H;
    const r = Math.max(W / v.videoWidth, H / v.videoHeight);
    const w = v.videoWidth * r, h = v.videoHeight * r;
    c.getContext("2d").drawImage(v, (W - w) / 2, (H - h) / 2, w, h);
    return c.toDataURL("image/jpeg", 0.7);
  }, []);

  useEffect(() => stop, [stop]);
  return { videoRef: attach, ready, error, starting, start, stop, capture };
}
