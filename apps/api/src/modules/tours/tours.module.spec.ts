import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

/**
 * Architecture fitness test for the tours API module (promptq.md Phase P2).
 *
 * Asserts that `apps/api/src/modules/tours/**` has zero references to legacy `EventKind`
 * symbols. The server is profile-native (TourFormProfile / TourDomainProfile) and must stay
 * that way; this test catches regressions even without ESLint (api app has no ESLint config —
 * its `lint` script is `tsc --noEmit`).
 *
 * Companion to `scripts/check-tour-domain-guardrails.mjs`, which runs the same check in CI
 * for both the api tours module and the web wizard scope.
 */

const TOURS_MODULE_ROOT = __dirname;

const FORBIDDEN_SYMBOLS = [
  "EventKind",
  "EventKindResolverInput",
  "resolveEventKindFromTourContext",
  "eventKindForDomainProfile",
  "domainProfileFromEventKindBestEffort",
] as const;

function walkTs(dir: string, acc: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      walkTs(p, acc);
    } else if (ent.isFile() && p.endsWith(".ts") && !p.endsWith(".d.ts")) {
      acc.push(p);
    }
  }
  return acc;
}

// Strip line- and block- comments so legitimate documentation that names the legacy symbols
// (e.g. "do not import EventKind" guidance) does not produce false positives. Naive but
// sufficient for an arch-fitness check.
function stripComments(source: string): string {
  let out = source.replace(/\/\*[\s\S]*?\*\//g, "");
  out = out.replace(/(^|[^:])\/\/.*$/gm, "$1");
  return out;
}

test("apps/api tours module is free of legacy EventKind symbols", () => {
  const files = walkTs(TOURS_MODULE_ROOT).filter(
    (p) => !p.endsWith(".spec.ts") && !p.endsWith(".unit-spec.ts"),
  );
  const violations: Array<{ file: string; symbol: string }> = [];

  for (const file of files) {
    const stripped = stripComments(readFileSync(file, "utf8"));
    for (const symbol of FORBIDDEN_SYMBOLS) {
      const re = new RegExp(`\\b${symbol}\\b`);
      if (re.test(stripped)) {
        violations.push({
          file: relative(TOURS_MODULE_ROOT, file),
          symbol,
        });
      }
    }
  }

  assert.equal(
    violations.length,
    0,
    `Tours API module must not reference legacy EventKind symbols.\n` +
      `Found:\n${violations.map((v) => `  - ${v.file}: ${v.symbol}`).join("\n")}\n` +
      `Allowed surfaces: @repo/types (definitions/bridge), apps/web adapters + observability + ` +
      `legacy Edit matrix (to be retired in Phase P6). See promptq.md.`,
  );
});
