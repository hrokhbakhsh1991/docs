/**
 * CW0-01 — deterministic JSON serialization for parity goldens.
 * Sorted keys, two-space indent, trailing newline.
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
export function stableStringify(value) {
  return `${JSON.stringify(sortDeep(value), null, 2)}\n`;
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function sortDeep(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = sortDeep(value[key]);
  }
  return out;
}
