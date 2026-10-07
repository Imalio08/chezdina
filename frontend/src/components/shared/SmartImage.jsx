import React, { useState } from "react";
import { ImageOff } from "lucide-react";

/**
 * Image avec fallback automatique en cas d'erreur de chargement.
 * - src vide/undefined → placeholder
 * - onError → remplace par placeholder (lettre ou icône)
 * - Préserve className et data-testid
 *
 * Props:
 *  - src: string | undefined
 *  - alt: string
 *  - className: string
 *  - fallbackText: string (lettre affichée dans le placeholder, par défaut la 1ère lettre d'alt)
 *  - fallbackIcon: boolean (si true, affiche l'icône ImageOff au lieu de la lettre)
 *  - loading: "lazy" | "eager"
 *  - 'data-testid': string
 */
export default function SmartImage({
  src,
  alt = "",
  className = "",
  fallbackText,
  fallbackIcon = false,
  loading = "lazy",
  style,
  ...rest
}) {
  const [failed, setFailed] = useState(false);
  const effectiveSrc = typeof src === "string" ? src.trim() : "";
  const showFallback = !effectiveSrc || failed;

  if (showFallback) {
    const letter = (fallbackText ?? alt ?? "?").toString().trim()[0]?.toUpperCase() || "?";
    return (
      <div
        className={`grid place-items-center bg-gradient-to-br from-[#fff5f5] to-[#fde8e8] dark:from-[#2a1818] dark:to-[#3a1a1a] text-[#b02a2a] ${className}`}
        style={style}
        role="img"
        aria-label={alt || "Image indisponible"}
        {...rest}
      >
        {fallbackIcon ? (
          <ImageOff size={24} className="opacity-50" />
        ) : (
          <span className="font-serif font-bold text-2xl opacity-60">{letter}</span>
        )}
      </div>
    );
  }

  return (
    <img
      src={effectiveSrc}
      alt={alt}
      loading={loading}
      className={className}
      style={style}
      onError={() => setFailed(true)}
      {...rest}
    />
  );
}
