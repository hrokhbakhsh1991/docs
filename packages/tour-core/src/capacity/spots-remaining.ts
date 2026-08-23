export function computeSpotsRemaining(
  totalCapacity: number | null,
  approvedPartySize: number
): number | null {
  if (totalCapacity === null) {
    return null;
  }
  return Math.max(0, totalCapacity - approvedPartySize);
}

export function withSpotsRemaining<T extends { totalCapacity: number | null }>(
  card: T,
  approvedPartySize: number
): T & { spotsRemaining: number | null } {
  return Object.freeze({
    ...card,
    spotsRemaining: computeSpotsRemaining(card.totalCapacity, approvedPartySize),
  });
}
