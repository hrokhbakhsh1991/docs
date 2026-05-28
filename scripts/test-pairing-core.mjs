/**
 * Test-Pairing governance: every subject component/service must have a co-located test.
 *
 * Accepted pairs (same directory as source):
 *   - `<base>.spec.ts(x)` | `<base>.test.ts(x)`
 *   - `__tests__/<base>.spec.ts(x)` | `__tests__/<base>.test.ts(x)`
 */
import fs from "node:fs";
import path from "node:path";

/**
 * Paths that require Test-Pairing (features/ and services/ trees in web + api).
 * @type {readonly RegExp[]}
 */
export const SUBJECT_PATH_PATTERNS = [
  /^apps\/web\/src\/features\/.+\.(ts|tsx)$/,
  /^apps\/web\/lib\/services\/.+\.ts$/,
  /^apps\/web\/src\/services\/.+\.ts$/,
  /^apps\/web\/services\/.+\.ts$/,
];

/** Roots scanned by `pnpm guardrails:test-pairing` (full audit). */
export const SUBJECT_SCAN_ROOTS = [
  "apps/web/src/features",
  "apps/web/lib/services",
  "apps/web/src/services",
  "apps/web/services",
];

const TEST_SUFFIXES = [".spec.ts", ".spec.tsx", ".test.ts", ".test.tsx"];

/**
 * @param {string} relPosix path relative to repo root
 */
export function isExcludedSubject(relPosix) {
  return (
    /\.(spec|test)\.(ts|tsx)$/.test(relPosix) ||
    /\/__tests__\//.test(relPosix) ||
    /\/testing\//.test(relPosix) ||
    /\.generated\.(ts|tsx)$/.test(relPosix) ||
    /\/index\.(ts|tsx)$/.test(relPosix) ||
    /\.types\.ts$/.test(relPosix) ||
    /\.dto\.ts$/.test(relPosix) ||
    /\.module\.ts$/.test(relPosix) ||
    /\.entity\.ts$/.test(relPosix) ||
    /\.interface\.ts$/.test(relPosix) ||
    /\.enum\.ts$/.test(relPosix) ||
    /\.placeholder\.ts$/.test(relPosix) ||
    /\.config\.ts$/.test(relPosix) ||
    /public-test-api\.ts$/.test(relPosix) ||
    // Leaf modules extracted to break cycles; covered by denaliInvariantEngine / denaliRuleAccess specs.
    /\/features\/tours\/domain\/denali-rules\//.test(relPosix) ||
    /\/wizard\/denali\/rules\/denali(CanonicalPaths|ContextualRules|FieldGate)\.ts$/.test(relPosix)
  );
}

/**
 * @param {string} relPosix path relative to repo root
 */
export function isSubjectFile(relPosix) {
  if (isExcludedSubject(relPosix)) return false;
  return SUBJECT_PATH_PATTERNS.some((pattern) => pattern.test(relPosix));
}

/**
 * @param {string} absolutePath
 */
export function hasTestPair(absolutePath) {
  const dir = path.dirname(absolutePath);
  const base = path.basename(absolutePath).replace(/\.(tsx?)$/, "");

  for (const suffix of TEST_SUFFIXES) {
    if (fs.existsSync(path.join(dir, `${base}${suffix}`))) return true;
  }

  const testsDir = path.join(dir, "__tests__");
  if (fs.existsSync(testsDir)) {
    for (const suffix of TEST_SUFFIXES) {
      if (fs.existsSync(path.join(testsDir, `${base}${suffix}`))) return true;
    }
  }

  return false;
}

/**
 * @param {string} repoRoot
 * @returns {{ rel: string, expected: string }[]}
 */
export function findMissingTestPairs(repoRoot) {
  const missing = [];

  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === "node_modules" || ent.name === "dist" || ent.name === ".next") continue;
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(ent.name)) continue;

      const rel = path.relative(repoRoot, abs).replace(/\\/g, "/");
      if (!isSubjectFile(rel)) continue;
      if (hasTestPair(abs)) continue;

      const ext = path.extname(ent.name);
      missing.push({
        rel,
        expected: `${path.basename(rel, ext)}.spec${ext}`,
      });
    }
  }

  for (const relRoot of SUBJECT_SCAN_ROOTS) {
    const absRoot = path.join(repoRoot, relRoot);
    if (fs.existsSync(absRoot)) walk(absRoot);
  }
  return missing.sort((a, b) => a.rel.localeCompare(b.rel));
}

/**
 * @param {string} relPosix
 * @param {string} [ext]
 */
export function formatTestPairMessage(relPosix, ext = path.extname(relPosix)) {
  const base = path.basename(relPosix, ext);
  const dir = path.dirname(relPosix);
  return (
    `Test-Pairing: "${relPosix}" requires a co-located test. ` +
    `Add \`${dir}/${base}.spec${ext}\` or \`${dir}/__tests__/${base}.spec${ext}\`.`
  );
}
