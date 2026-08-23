import type { PublicCatalogCard } from "@app-tour/workspace-sdk";
import {
  computeSpotsRemaining,
  withSpotsRemaining as withSpotsRemainingCore,
} from "@app-tour/tour-core";

export { computeSpotsRemaining };

export function withSpotsRemaining(
  card: PublicCatalogCard,
  approvedPartySize: number
): PublicCatalogCard {
  return withSpotsRemainingCore(card, approvedPartySize);
}
