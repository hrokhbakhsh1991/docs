/**
 * Normalizes a workspace theme CSS custom property name to `--*` form.
 * Used by ingress validation and web providers before DOM injection.
 */
export function normalizeThemeCssKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }
  return trimmed.startsWith("--") ? trimmed : `--${trimmed}`;
}
