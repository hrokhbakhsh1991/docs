import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_JSON = join(PACKAGE_ROOT, "package.json");
const SRC_DIR = join(PACKAGE_ROOT, "src");

const ALLOWED_RUNTIME_DEPS = new Set([
  "@app-tour/platform-core",
  "@app-tour/platform-events",
  "@app-tour/tenant-kernel",
  "@app-tour/workspace-sdk",
  "@app-tour/workspace-denali",
  "@app-tour/workspace-starter",
  "@app-tour/workspace-urban",
  "@casl/ability",
  "@prisma/client",
  "ioredis",
  "jose",
  "zod",
  "pino",
  "rate-limiter-flexible",
]);

const FORBIDDEN_IMPORT_PATTERNS = [
  /@app-tour\/ui-primitives/,
  /@app-tour\/theme-react/,
  /@app-tour\/design-tokens/,
  /^@app-tour\/ui-primitives$/,
];

function listTsFiles(dir: string, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      listTsFiles(p, out);
    } else if (ent.name.endsWith(".ts")) {
      out.push(p);
    }
  }
  return out;
}

describe("P3-E-API-01 package boundary", () => {
  it("runtime deps exclude ui-primitives, theme-react, and design-tokens", () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8")) as {
      dependencies?: Record<string, string>;
    };
    const deps = Object.keys(pkg.dependencies ?? {});
    assert.deepEqual(new Set(deps), ALLOWED_RUNTIME_DEPS);
  });

  it("source tree has no ui-primitives or barrel imports", () => {
    const hits: string[] = [];
    for (const file of listTsFiles(SRC_DIR)) {
      const src = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        if (pattern.test(src)) {
          hits.push(`${file}: ${pattern}`);
        }
      }
    }
    assert.deepEqual(hits, []);
  });
});
