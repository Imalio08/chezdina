import React from "react";
import { Save, Loader2 } from "lucide-react";

/**
 * Standard save button with loading + double-click protection.
 * Usage: <SaveButton loading={saving} onClick={handleSave} />
 */
export default function SaveButton({
  loading = false,
  disabled = false,
  onClick,
  children,
  icon = true,
  variant = "primary",
  size = "md",
  testid = "save-btn",
  type = "button",
  className = "",
  loadingLabel = "Enregistrement…",
}) {
  const base = variant === "primary" ? "dina-btn-primary" : "dina-btn-secondary";
  const sz = size === "sm" ? "!min-h-[36px] text-xs" : "";
  const isDisabled = loading || disabled;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading}
      className={`${base} ${sz} ${isDisabled ? "opacity-60 cursor-not-allowed" : ""} ${className}`}
      data-testid={testid}
    >
      {loading ? <Loader2 size={13} className="animate-spin"/> : (icon ? <Save size={13}/> : null)}
      <span>{loading ? loadingLabel : (children || "Enregistrer")}</span>
    </button>
  );
}
