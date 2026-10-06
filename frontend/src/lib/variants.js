/**
 * Variants helpers for the storefront + POS.
 * variants: [{ size, color, stock, enabled, price? }]
 * - combosFor(variants) → Map<size, Set<color>>
 * - availableColorsForSize(variants, size)
 * - availableSizesForColor(variants, color)
 * - stockFor(variants, size, color) → number (0 if not existing or not enabled)
 * - hasRealVariants(product) → true if product uses the new variants grid
 */
export function hasRealVariants(product) {
  return Array.isArray(product?.variants) && product.variants.some(v => v.enabled);
}
export function enabledVariants(product) {
  return (product?.variants || []).filter(v => v.enabled);
}
export function availableColorsForSize(product, size) {
  if (!hasRealVariants(product)) return product?.colors || [];
  return Array.from(new Set(enabledVariants(product).filter(v => v.size === size).map(v => v.color)));
}
export function availableSizesForColor(product, color) {
  if (!hasRealVariants(product)) return product?.sizes || [];
  return Array.from(new Set(enabledVariants(product).filter(v => v.color === color).map(v => v.size)));
}
export function stockFor(product, size, color) {
  if (hasRealVariants(product)) {
    const v = (product.variants || []).find(v => v.enabled && v.size === size && v.color === color);
    return v ? Number(v.stock || 0) : 0;
  }
  return Number(product?.stock_by_size?.[size] ?? product?.stock ?? 0);
}
export function comboExists(product, size, color) {
  if (!hasRealVariants(product)) return true;
  return (product.variants || []).some(v => v.enabled && v.size === size && v.color === color);
}
