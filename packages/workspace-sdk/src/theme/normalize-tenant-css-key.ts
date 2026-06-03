import { normalizeThemeCssKey } from "./normalize-theme-css-key";

const TENANT_CSS_KEY_PATTERN = /^--(?!ws-)[a-z][a-z0-9-]*$/;

/**
 * Normalizes a tenant theme CSS custom property name and rejects workspace-scoped `--ws-*` keys.
 */
export function normalizeTenantCssKey(key: string): string {
  const normalized = normalizeThemeCssKey(key);
  if (!TENANT_CSS_KEY_PATTERN.test(normalized)) {
    return "";
  }
  return normalized;
}

export function isValidTenantCssKey(key: string): boolean {
  return normalizeTenantCssKey(key).length > 0;
}
