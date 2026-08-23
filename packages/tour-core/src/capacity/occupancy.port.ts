export type OccupancyRow = {
  readonly status: string;
  readonly partySize: number | null;
};

/**
 * Neutral occupancy port — sum seats for rows matching a native consuming status string.
 * Adapters pass workspace vocabulary (`approved` vs `confirmed`) without normalization.
 */
export type OccupancyPort = {
  readonly sumOccupyingSeats: (rows: readonly OccupancyRow[]) => number;
};

export function sumOccupyingSeatsForStatus(
  rows: readonly OccupancyRow[],
  occupyingStatus: string,
): number {
  let total = 0;
  for (const row of rows) {
    if (row.status !== occupyingStatus) {
      continue;
    }
    total += row.partySize ?? 1;
  }
  return total;
}
