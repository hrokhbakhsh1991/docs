import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const BARREL = /^@app-tour\/ui-primitives$/;
const SUBPATH =
  /^@app-tour\/ui-primitives\/(button|input|select|checkbox|field-shell|alert|badge|otp-segment-input-logic)$/;

function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) listSourceFiles(p, out);
    else if (/\.(tsx?)$/.test(ent.name)) out.push(p);
  }
  return out;
}

function extractImportSpecifiers(src: string): string[] {
  const specs: string[] = [];
  const patterns = [
    /from\s+["']([^"']+)["']/g,
    /import\s+["']([^"']+)["']/g,
  ];
  for (const pattern of patterns) {
    for (const match of src.matchAll(pattern)) {
      specs.push(match[1]!);
    }
  }
  return specs;
}

describe("P3-E-PRIM-BARREL barrel hunt (apps/web/src)", () => {
  it("has zero non-subpath @app-tour/ui-primitives imports", () => {
    const violations: string[] = [];
    for (const file of listSourceFiles(SRC_DIR)) {
      const specs = extractImportSpecifiers(readFileSync(file, "utf8"));
      for (const spec of specs) {
        if (!spec.startsWith("@app-tour/ui-primitives")) continue;
        if (BARREL.test(spec) || !SUBPATH.test(spec)) {
          violations.push(`${file}: ${spec}`);
        }
      }
    }
    assert.deepEqual(violations, []);
  });

  it("WEB-DENALI-CLIENT-01 wizard client graph avoids workspace-denali root barrel", () => {
    const wizardDir = join(SRC_DIR, "wizard");
    const violations: string[] = [];
    for (const file of listSourceFiles(wizardDir)) {
      const specs = extractImportSpecifiers(readFileSync(file, "utf8"));
      for (const spec of specs) {
        if (spec === "@app-tour/workspace-denali") {
          violations.push(`${file}: ${spec}`);
        }
      }
    }
    assert.deepEqual(violations, []);
  });
});
