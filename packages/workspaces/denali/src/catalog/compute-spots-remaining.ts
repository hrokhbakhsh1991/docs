import type { PublicCatalogCard } from "@app-tour/workspace-sdk";

export function computeSpotsRemaining(
  totalCapacity: number | null,
  approvedPartySize: number
): number | null {
  if (totalCapacity === null) {
    return null;
  }
  return Math.max(0, totalCapacity - approvedPartySize);
}

export function withSpotsRemaining(
  card: PublicCatalogCard,
  approvedPartySize: number
): PublicCatalogCard {
  return Object.freeze({
    ...card,
    spotsRemaining: computeSpotsRemaining(card.totalCapacity, approvedPartySize),
  });
}
