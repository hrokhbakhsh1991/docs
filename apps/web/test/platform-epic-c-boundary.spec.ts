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

describe("platform epic C boundary", () => {
  it("no denali/ui under platform tree", () => {
    const roots = [
      path.join(webRoot, "src/platform"),
      path.join(webRoot, "app/(platform)"),
    ];
    for (const root of roots) {
      for (const file of collectSourceFiles(root)) {
        const source = readFileSync(file, "utf8");
        assert.doesNotMatch(
          source,
          /denali\/ui/,
          `${path.relative(webRoot, file)} must not import denali/ui`
        );
      }
    }
  });

  it("create club wizard lives under platform", () => {
    const wizard = readFileSync(
      path.join(webRoot, "src/platform/create-club/create-club-wizard-client.tsx"),
      "utf8"
    );
    assert.match(wizard, /fetchPlatformApi/);
    assert.doesNotMatch(wizard, /denali\/ui/);
  });
});
