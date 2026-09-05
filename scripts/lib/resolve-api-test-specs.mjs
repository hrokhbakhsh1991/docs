#!/usr/bin/env node
/**
 * Map changed apps/api paths → trunk spec files for pre-commit test:file runs.
 * Prints JSON: { specs: string[], fallbackBaseline: boolean }
 * @see docs/dev/tiered-testing.md
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const API_ROOT = join(REPO_ROOT, "apps/api");
const TEST_ROOT = join(API_ROOT, "test");

/** Non-production API paths — ignored for spec resolution (do not trigger fallback). */
const IGNORABLE_PREFIXES = ["apps/api/scripts/", "apps/api/docs/"];

/** @type {Array<{ prefix: string; patterns: string[] }>} */
const PREFIX_SPECS = [
  { prefix: "apps/api/src/identity/", patterns: ["test/identity-*.spec.ts"] },
  { prefix: "apps/api/src/settings/", patterns: ["test/settings-*.spec.ts"] },
  { prefix: "apps/api/src/bookings/", patterns: ["test/bookings-*.spec.ts"] },
  { prefix: "apps/api/src/tours/", patterns: ["test/tours-*.spec.ts"] },
  { prefix: "apps/api/src/finance/", patterns: ["test/finance-*.spec.ts"] },
  {
    prefix: "apps/api/src/workspace-ticketing/",
    patterns: ["test/ticketing-*.spec.ts", "test/*ticketing*.spec.ts"],
  },
  {
    prefix: "apps/api/src/workspace-engagement/",
    patterns: ["test/*engagement*.spec.ts", "test/member-notifications*.spec.ts"],
  },
  {
    prefix: "apps/api/src/workspace-wallet/",
    patterns: ["test/*wallet*.spec.ts", "test/denali-wallet*.spec.ts"],
  },
  {
    prefix: "apps/api/src/notifications/",
    patterns: ["test/member-notifications*.spec.ts"],
  },
  {
    prefix: "apps/api/src/http/",
    patterns: [
      "test/ticketing-*.spec.ts",
      "test/*wallet*.spec.ts",
      "test/package-boundary.spec.ts",
    ],
  },
  {
    prefix: "apps/api/src/exposure/",
    patterns: ["test/field-exposure-*.spec.ts", "test/4-integration/field-exposure-*.spec.ts"],
  },
  {
    prefix: "apps/api/src/integrations/",
    patterns: ["test/integrations-*.spec.ts", "test/field-exposure-*.spec.ts"],
  },
  {
    prefix: "apps/api/prisma/",
    patterns: ["test/phase-9-persistence.integration.spec.ts"],
  },
];

function isIgnorable(path) {
  return IGNORABLE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * @param {string} pattern e.g. test/identity-*.spec.ts or test/4-integration/field-exposure-*.spec.ts
 * @returns {string[]}
 */
function resolvePattern(pattern) {
  if (!pattern.startsWith("test/")) return [];
  const rest = pattern.slice("test/".length);
  const slash = rest.lastIndexOf("/");
  const subdir = slash >= 0 ? rest.slice(0, slash) : "";
  const fileGlob = slash >= 0 ? rest.slice(slash + 1) : rest;
  const dir = subdir ? join(TEST_ROOT, subdir) : TEST_ROOT;
  if (!existsSync(dir)) return [];

  const re = new RegExp(`^${fileGlob.replace(/\./g, "\\.").replace(/\*/g, ".*")}$`);
  /** @type {string[]} */
  const found = [];
  for (const name of readdirSync(dir)) {
    if (!re.test(name)) continue;
    found.push(subdir ? `test/${subdir}/${name}` : `test/${name}`);
  }
  return found;
}

/**
 * @param {string} path
 * @returns {{ specs: string[], resolvable: boolean, ignorable: boolean }}
 */
function specsForPath(path) {
  if (!path.startsWith("apps/api/")) {
    return { specs: [], resolvable: false, ignorable: false };
  }

  if (isIgnorable(path)) {
    return { specs: [], resolvable: false, ignorable: true };
  }

  if (path.endsWith(".spec.ts")) {
    if (path.startsWith("apps/api/test/")) {
      return { specs: [path.slice("apps/api/".length)], resolvable: true, ignorable: false };
    }
    if (path.startsWith("apps/api/src/")) {
      return { specs: [path.slice("apps/api/".length)], resolvable: true, ignorable: false };
    }
    return { specs: [], resolvable: true, ignorable: false };
  }

  for (const { prefix, patterns } of PREFIX_SPECS) {
    if (!path.startsWith(prefix)) continue;
    const specs = patterns.flatMap((p) => resolvePattern(p));
    return { specs, resolvable: true, ignorable: false };
  }

  return { specs: [], resolvable: true, ignorable: false };
}

function main() {
  const input = readFileSync(0, "utf8");
  const paths = input
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  /** @type {Set<string>} */
  const specs = new Set();
  let hasResolvableApi = false;

  for (const p of paths) {
    if (!p.startsWith("apps/api/")) continue;
    const { specs: found, resolvable, ignorable } = specsForPath(p);
    if (ignorable) continue;
    if (resolvable) hasResolvableApi = true;
    for (const s of found) specs.add(s);
  }

  const result = {
    specs: [...specs].sort(),
    fallbackBaseline: hasResolvableApi && specs.size === 0,
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main();
