import { isAppLocale, routing, type AppLocale } from "./routing";

export function resolveAppLocale(input: {
  readonly cookieLocale: AppLocale | null;
  readonly tenantDefaultLocale: string | null | undefined;
}): AppLocale {
  if (input.cookieLocale !== null) {
    return input.cookieLocale;
  }
  const tenantDefault = input.tenantDefaultLocale?.trim();
  if (tenantDefault !== undefined && tenantDefault.length > 0 && isAppLocale(tenantDefault)) {
    return tenantDefault;
  }
  return routing.defaultLocale;
}
