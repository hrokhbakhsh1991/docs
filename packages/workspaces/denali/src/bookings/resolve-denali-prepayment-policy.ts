export type DenaliPrepaymentPolicy = {
  readonly enabled: boolean;
  readonly percent: number | null;
};

function readCanonicalPath(data: unknown, path: string): unknown {
  if (data === null || typeof data !== "object") {
    return undefined;
  }
  let current: unknown = data;
  for (const part of path.split(".")) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function readBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

function readInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) ? value : Math.trunc(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizePrepaymentPercent(value: unknown): number | null {
  const percent = readInteger(value);
  if (percent === null || percent < 1 || percent > 100) {
    return null;
  }
  return percent;
}

export function resolveDenaliPrepaymentPolicy(tourCanonicalData: unknown): DenaliPrepaymentPolicy {
  const enabled = readBoolean(readCanonicalPath(tourCanonicalData, "pricing.prepaymentEnabled"));
  const percent = normalizePrepaymentPercent(
    readCanonicalPath(tourCanonicalData, "pricing.prepaymentPercent")
  );
  return {
    enabled: enabled && percent !== null,
    percent,
  };
}

export function resolveDenaliSuggestedPrepaymentMinor(input: {
  readonly tourCanonicalData: unknown;
  readonly invoiceTotalMinor: string;
  readonly balanceDueMinor: string;
}): string | null {
  const policy = resolveDenaliPrepaymentPolicy(input.tourCanonicalData);
  if (!policy.enabled || policy.percent === null) {
    return null;
  }

  const totalTrimmed = input.invoiceTotalMinor.trim();
  const dueTrimmed = input.balanceDueMinor.trim();
  if (!/^\d+$/.test(totalTrimmed) || !/^\d+$/.test(dueTrimmed)) {
    return null;
  }

  const invoiceTotal = BigInt(totalTrimmed);
  const balanceDue = BigInt(dueTrimmed);
  if (invoiceTotal <= BigInt(0) || balanceDue <= BigInt(0)) {
    return null;
  }

  const suggested = (invoiceTotal * BigInt(policy.percent)) / BigInt(100);
  if (suggested <= BigInt(0)) {
    return null;
  }

  return (suggested < balanceDue ? suggested : balanceDue).toString();
}
