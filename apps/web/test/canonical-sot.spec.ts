import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

const FORBIDDEN_LEGACY_API = [
  /\/api\/v1\/tours/,
  /legacy\/apps\/api/,
  /workspace_tour_templates/,
  /denali-canonical-template/,
];

function listTsFiles(dir: string, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) listTsFiles(p, out);
    else if (/\.(tsx?)$/.test(ent.name)) out.push(p);
  }
  return out;
}

describe("Phase 3.4 canonical SoT (apps/web)", () => {
  it("has no legacy API or template table references in source", () => {
    const hits: string[] = [];
    for (const file of listTsFiles(SRC)) {
      const src = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_LEGACY_API) {
        if (pattern.test(src)) hits.push(`${file}: ${pattern}`);
      }
    }
    assert.deepEqual(hits, []);
  });
});
