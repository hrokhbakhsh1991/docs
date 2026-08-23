/** Workspace-scoped catalog tour used for member OTP login egress (dev smoke ids). */
const MEMBER_LOGIN_TOUR_BY_PLUGIN: Readonly<Record<string, string>> = Object.freeze({
  denali: "00000000-0000-4000-8000-000000000220",
  urban: "00000000-0000-4000-8000-000000000410",
  operator: "00000000-0000-4000-8000-000000000210",
  "guest-club": "00000000-0000-4000-8000-000000000420",
  harbor: "00000000-0000-4000-8000-000000000521",
});

export function resolveMemberLoginCatalogTourId(pluginId: string | null): string {
  if (pluginId !== null) {
    const configured = MEMBER_LOGIN_TOUR_BY_PLUGIN[pluginId];
    if (configured !== undefined) {
      return configured;
    }
  }
  const configured =
    process.env.PORTAL_MEMBER_LOGIN_TOUR_ID?.trim() || process.env.PORTAL_DEV_GUEST_TOUR_ID?.trim();
  if (configured !== undefined && configured.length > 0) {
    return configured;
  }
  throw new Error("MEMBER_LOGIN_CATALOG_TOUR_ID_UNRESOLVED");
}
