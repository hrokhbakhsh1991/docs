import { z } from "zod";

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Filters JSONB id arrays (`gear*Ids`, `tourThemeIds`, …) to v4 UUID strings. */
export function filterUuidV4Strings(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    if (typeof x !== "string") {
      continue;
    }
    const t = x.trim();
    if (!UUID_V4_RE.test(t) || seen.has(t)) {
      continue;
    }
    seen.add(t);
    out.push(t);
  }
  return out;
}

export const optionalTrimmedString = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((v) => (v === undefined || v.trim() === "" ? undefined : v.trim()));

export const optionalUuidV4 = z.string().uuid().optional();

export const optionalUuidV4List = z
  .array(z.string().uuid())
  .optional()
  .transform((arr) => {
    if (arr == null || arr.length === 0) {
      return undefined;
    }
    const next = filterUuidV4Strings(arr);
    return next.length > 0 ? next : undefined;
  });

export const optionalStringList = z
  .array(z.string().max(500))
  .optional()
  .transform((arr) => {
    if (arr == null || arr.length === 0) {
      return undefined;
    }
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of arr) {
      const t = item.trim();
      if (!t || seen.has(t)) {
        continue;
      }
      seen.add(t);
      out.push(t);
    }
    return out.length > 0 ? out : undefined;
  });

export const optionalTimeHhmm = optionalTrimmedString(5).refine(
  (v) => v === undefined || /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
  { message: "time must be empty or HH:mm" },
);

export const optionalYmdDate = optionalTrimmedString(32).refine(
  (v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v),
  { message: "date must be YYYY-MM-DD" },
);
