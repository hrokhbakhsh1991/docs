#!/usr/bin/env node
/**
 * Map changed apps/web paths to directly related unit/contract specs.
 * Prints JSON: { specs: string[], fallbackBaseline: boolean }
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const WEB_ROOT = join(REPO_ROOT, "apps/web");
const TEST_ROOT = join(WEB_ROOT, "test");
const IGNORABLE_PREFIXES = ["apps/web/scripts/", "apps/web/docs/"];

function listSpecs(dir = TEST_ROOT) {
  if (!existsSync(dir)) return [];
  const specs = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "e2e") specs.push(...listSpecs(absolute));
      continue;
    }
    if (!/\.spec\.tsx?$/.test(entry.name)) continue;
    specs.push(relative(WEB_ROOT, absolute));
  }
  return specs.sort();
}

const ALL_SPECS = listSpecs();

function referencedSpecs(webRelativePath) {
  const withoutExtension = webRelativePath.slice(
    0,
    webRelativePath.length - extname(webRelativePath).length
  );
  const needles = [
    webRelativePath,
    withoutExtension,
    `../${webRelativePath}`,
    `../${withoutExtension}`,
  ];
  return ALL_SPECS.filter((spec) => {
    const source = readFileSync(join(WEB_ROOT, spec), "utf8");
    return needles.some((needle) => source.includes(needle));
  });
}

function specsForPath(path) {
  if (!path.startsWith("apps/web/")) {
    return { specs: [], resolvable: false, ignorable: false };
  }
  if (IGNORABLE_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return { specs: [], resolvable: false, ignorable: true };
  }

  const webRelative = path.slice("apps/web/".length);
  if (webRelative.startsWith("test/") && /\.spec\.tsx?$/.test(webRelative)) {
    return { specs: [webRelative], resolvable: true, ignorable: false };
  }

  return {
    specs: referencedSpecs(webRelative),
    resolvable: true,
    ignorable: false,
  };
}

function main() {
  const paths = readFileSync(0, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const specs = new Set();
  let hasResolvableWeb = false;

  for (const path of paths) {
    const result = specsForPath(path);
    if (result.ignorable) continue;
    if (result.resolvable) hasResolvableWeb = true;
    for (const spec of result.specs) specs.add(spec);
  }

  process.stdout.write(
    `${JSON.stringify({
      specs: [...specs].sort(),
      fallbackBaseline: hasResolvableWeb && specs.size === 0,
    })}\n`
  );
}

main();
