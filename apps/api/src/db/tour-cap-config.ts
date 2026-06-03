export type TourCapLimits = {
  readonly maxPerTenant: number;
  readonly maxGlobal: number;
};

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.length === 0) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

export function readTourCapLimits(): TourCapLimits {
  return {
    maxPerTenant: parsePositiveInt(process.env.MAX_TOURS_PER_TENANT, 10_000),
    maxGlobal: parsePositiveInt(process.env.MAX_TOURS_GLOBAL, 100_000),
  };
}
