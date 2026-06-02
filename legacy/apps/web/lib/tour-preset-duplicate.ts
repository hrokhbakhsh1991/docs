/** Deep clone JSON-serializable preset defaults (avoid shared refs when duplicating). */
export function deepClonePresetDefaults<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function nextTourPresetSortOrder(presets: readonly { sortOrder: number }[]): number {
  if (!presets.length) return 0;
  return Math.max(...presets.map((p) => p.sortOrder)) + 1;
}

/**
 * Names like `Original — copySuffix`, then `Original — copySuffix (2)`… trimmed to maxLen.
 */
export function buildDuplicatePresetName(
  sourceName: string,
  copySuffix: string,
  takenNames: Iterable<string>,
  maxLen = 120,
): string {
  const taken = new Set([...takenNames].map((n) => n.trim().toLowerCase()));
  const base = sourceName.trim();
  const suf = copySuffix.trim();
  let stem = `${base} — ${suf}`.replace(/\s+/g, " ").trim();
  let candidate = stem.slice(0, maxLen);
  let n = 2;
  while (taken.has(candidate.toLowerCase())) {
    stem = `${base} — ${suf} (${n})`.replace(/\s+/g, " ").trim();
    candidate = stem.slice(0, maxLen);
    n += 1;
    if (n > 100) break;
  }
  return candidate;
}
