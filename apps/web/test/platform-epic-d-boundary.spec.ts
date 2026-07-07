import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (/\.(tsx?|jsx?)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("platform epic D boundary", () => {
  it("club detail tree has no denali/ui", () => {
    const roots = [
      path.join(webRoot, "src/platform/club-detail"),
      path.join(webRoot, "app/(platform)/platform/clubs"),
    ];
    for (const root of roots) {
      for (const file of collectSourceFiles(root)) {
        const source = readFileSync(file, "utf8");
        assert.doesNotMatch(source, /denali\/ui/);
      }
    }
  });

  it("clubs table links to detail", () => {
    const table = readFileSync(
      path.join(webRoot, "src/platform/platform-clubs-table.tsx"),
      "utf8"
    );
    assert.match(table, /\/platform\/clubs\/\$\{item\.id\}/);
  });
});
