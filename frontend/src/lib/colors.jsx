const MAP = {
  noir: "#1c1c1c", blanc: "#ffffff", beige: "#e8d4b8", rouge: "#c62828", bleu: "#2563eb", vert: "#1f8a4c", rose: "#ec4899",
  gris: "#9e9e9e", marron: "#8b4513", or: "#d4af37", "doré": "#d4af37", dore: "#d4af37", argent: "#c0c0c0", nude: "#f3dcc4",
  camel: "#c19a6b", bordeaux: "#800020", mauve: "#b784a7", orange: "#f28c28", jaune: "#f4c430", kaki: "#8a865d", taupe: "#8b7d6b",
  multi: "conic-gradient(#c62828, #f4c430, #1f8a4c, #2563eb, #b784a7, #c62828)",
};
export const colorCss = (name) => MAP[(name || "").trim().toLowerCase()] || "#9e9e9e";

export function ColorSwatch({ name, size = 28, selected, disabled, onClick, testid }) {
  const isWhite = /^(blanc|nude|beige)$/i.test((name || "").trim());
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={name} aria-label={name} data-testid={testid}
      className={`relative rounded-full transition-transform ${selected ? "ring-2 ring-offset-2 ring-[#1c1c1c] dark:ring-white" : ""} ${disabled ? "opacity-30 cursor-not-allowed" : "hover:scale-110"}`}
      style={{ width: size, height: size, background: colorCss(name), border: isWhite ? "1px solid #ddd" : "1px solid transparent" }}>
      {disabled && <span className="absolute inset-0 flex items-center justify-center"><span className="block w-full h-px bg-[#666] rotate-45"/></span>}
      {selected && !disabled && <span className="absolute inset-0 grid place-items-center" aria-hidden><span className="w-[55%] h-[55%] rounded-full bg-white text-[#1c1c1c] border border-[#1c1c1c] grid place-items-center text-[10px] font-bold shadow">✓</span></span>}
    </button>
  );
}
