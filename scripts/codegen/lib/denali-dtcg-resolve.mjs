/**
 * Resolve DTCG token references for Denali shared parity guards.
 */

/**
 * @param {Record<string, unknown>} groups
 * @param {string[]} prefix
 * @returns {Record<string, string>}
 */
export function flattenDtcgTokenValues(groups, prefix = []) {
  /** @type {Record<string, string>} */
  const flat = {};

  for (const [key, value] of Object.entries(groups)) {
    if (value === null || typeof value !== "object") {
      continue;
    }

    const path = [...prefix, key].join(".");

    if ("$value" in value && typeof value.$value === "string") {
      flat[path] = value.$value;
      continue;
    }

    Object.assign(flat, flattenDtcgTokenValues(value, [...prefix, key]));
  }

  return flat;
}

/**
 * @param {Record<string, string>} flat
 * @param {string} raw
 * @param {Set<string>} [seen]
 */
export function resolveDtcgReferenceValue(flat, raw, seen = new Set()) {
  const trimmed = raw.trim();
  const match = trimmed.match(/^\{([a-z0-9.-]+)\}$/i);
  if (!match) {
    return trimmed;
  }

  const refPath = match[1];
  if (seen.has(refPath)) {
    throw new Error(`DENALI_DTCG_CIRCULAR_REF:${refPath}`);
  }

  const target = flat[refPath];
  if (target === undefined) {
    throw new Error(`DENALI_DTCG_UNRESOLVED_REF:${refPath}`);
  }

  seen.add(refPath);
  return resolveDtcgReferenceValue(flat, target, seen);
}

/**
 * @param {Record<string, unknown>} tokenGroups
 */
export function resolveDtcgTokenGroups(tokenGroups) {
  const flat = flattenDtcgTokenValues(tokenGroups);
  /** @type {Record<string, string>} */
  const resolved = {};

  for (const [path, raw] of Object.entries(flat)) {
    resolved[path] = resolveDtcgReferenceValue(flat, raw);
  }

  return resolved;
}

/**
 * @param {Record<string, unknown>} slice
 * @param {number} [blockIndex]
 */
export function readDenaliLightSemanticGroups(slice, blockIndex = 0) {
  if (Array.isArray(slice.blocks)) {
    const block = slice.blocks[blockIndex];
    if (!block || typeof block !== "object") {
      throw new Error("DENALI_DTCG_MISSING_LIGHT_BLOCK");
    }
    return block;
  }

  return slice;
}
