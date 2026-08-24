/** CW9-03 — synthetic cert-club transport snapshot (no Denali dong/personal-car rules). */
export function readCertClubCatalogTransportSnapshot(
  _canonical: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    transportKind: "none",
    requiresTransport: false,
  });
}
