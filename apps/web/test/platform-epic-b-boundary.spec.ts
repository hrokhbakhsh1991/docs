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

describe("platform epic B boundary (P3-B-N-009)", () => {
  it("BD-01 no denali/ui imports under wizard/platform", () => {
    const root = path.join(webRoot, "src/wizard/platform");
    for (const file of collectSourceFiles(root)) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(
        source,
        /@app-tour\/workspace-denali\/ui|packages\/workspaces\/denali/,
        `${path.relative(webRoot, file)} must not import denali ui`
      );
    }
  });
});
