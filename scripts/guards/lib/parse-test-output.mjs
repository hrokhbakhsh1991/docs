/**
 * Shared Node test runner output parsing for phase gates.
 * Supports TAP (`# tests N`) and spec reporter (`ℹ tests N`).
 */

/** @param {string} output */
export function parseTestCount(output) {
  const matches = [...String(output).matchAll(/[#ℹ] tests (\d+)/g)];
  if (matches.length === 0) {
    return null;
  }
  return Number.parseInt(matches[matches.length - 1][1], 10);
}

/** Sum all `# tests N` / `ℹ tests N` lines (chained pnpm scripts). */
export function parseTestCountSum(output) {
  const matches = [...String(output).matchAll(/[#ℹ] tests (\d+)/g)];
  if (matches.length === 0) {
    return null;
  }
  return matches.reduce((sum, m) => sum + Number.parseInt(m[1], 10), 0);
}

/** @param {string} output */
export function outputHasTestFailures(output) {
  return [...String(output).matchAll(/[#ℹ] fail (\d+)/g)].some((m) => Number.parseInt(m[1], 10) > 0);
}

/**
 * @param {import("node:child_process").SpawnSyncReturns<string>} result
 * @param {number} minCount
 */
export function evaluatePackageTestRun(result, minCount) {
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const count = parseTestCount(output);
  const ok = result.status === 0 && count !== null && count >= minCount && !outputHasTestFailures(output);
  return { ok, count, output };
}
