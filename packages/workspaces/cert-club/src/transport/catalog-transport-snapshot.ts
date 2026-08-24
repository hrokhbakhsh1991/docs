/** CW9-03 — synthetic cert-club transport snapshot (no Denali dong/personal-car rules). */
import type { PublicCatalogTransportSnapshot } from "@app-tour/workspace-sdk";

export function readCertClubCatalogTransportSnapshot(
  _canonical: Readonly<Record<string, unknown>>
): PublicCatalogTransportSnapshot | undefined {
  return Object.freeze({
    mode: "none",
  });
}
