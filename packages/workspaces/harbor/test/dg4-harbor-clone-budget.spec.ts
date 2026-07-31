import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (name.endsWith(".ts") && !name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("DG-4.2 harbor clone detector lite", () => {
  it("keeps HTTP surface tiny vs Denali-scale forests", () => {
    const httpFiles = listTsFiles(join(root, "src/http"));
    assert.ok(
      httpFiles.length <= 6,
      `expected ≤6 harbor http modules, got ${httpFiles.length}`,
    );
  });

  it("does not import workspace-denali from harbor src", () => {
    for (const file of listTsFiles(join(root, "src"))) {
      const text = readFileSync(file, "utf8");
      assert.doesNotMatch(
        text,
        /@app-tour\/workspace-denali/,
        `denali import in ${file}`,
      );
    }
  });
});
