/**
 * Golden diff helpers for submit vs clone CreateTourDto parity audits.
 */

export const SUBMIT_CLONE_PARITY_ALLOWLIST = new Set([
  "title",
  "lifecycle_status",
  "capacity",
  "total_capacity",
  "communicationLink",
  "chat_link",
  "cost_context",
  "sourceTourId",
  "sourcePresetId",
  "stagingTourId",
  "tripDetails",
  "customServiceLabels",
  "formProfile",
  "metadata",
  /** Submit projection maps pricing; headless clone CreateTourDto omits these today. */
  "price",
  "requiresPayment",
  "paymentMode",
  "autoAcceptRegistrations",
]);

export type ParityDivergence = {
  path: string;
  submitValue: unknown;
  cloneValue: unknown;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export function collectSubmitCloneDivergences(
  submitSide: Record<string, unknown>,
  cloneSide: Record<string, unknown>,
  prefix = "",
): ParityDivergence[] {
  const divergences: ParityDivergence[] = [];
  const keys = new Set([...Object.keys(submitSide), ...Object.keys(cloneSide)]);

  for (const key of keys) {
    const path = prefix ? `${prefix}.${key}` : key;
    const topKey = path.split(".")[0] ?? path;
    if (SUBMIT_CLONE_PARITY_ALLOWLIST.has(topKey)) {
      continue;
    }

    const left = submitSide[key];
    const right = cloneSide[key];

    if (isPlainObject(left) && isPlainObject(right)) {
      divergences.push(...collectSubmitCloneDivergences(left, right, path));
      continue;
    }

    if (JSON.stringify(left) !== JSON.stringify(right)) {
      divergences.push({ path, submitValue: left, cloneValue: right });
    }
  }

  return divergences;
}

export function formatParityDivergenceReport(divergences: readonly ParityDivergence[]): string {
  if (divergences.length === 0) {
    return "no divergences outside allowlist";
  }
  return divergences
    .map(
      (d) =>
        `  ${d.path}: submit=${JSON.stringify(d.submitValue)} clone=${JSON.stringify(d.cloneValue)}`,
    )
    .join("\n");
}
