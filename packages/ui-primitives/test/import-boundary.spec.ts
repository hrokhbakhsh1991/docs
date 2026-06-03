import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");

describe("ui-primitives token import boundary", () => {
  it("does not import design-tokens CSS under src/", () => {
    const offenders: string[] = [];
    for (const rel of walkSourceFiles(srcRoot)) {
      const text = fs.readFileSync(path.join(srcRoot, rel), "utf8");
      if (text.includes("@app-tour/design-tokens/styles.css")) {
        offenders.push(rel);
      }
      if (/@app-tour\/design-tokens\/[^"']*\.css["']/.test(text)) {
        offenders.push(rel);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `src/ must not import design-tokens CSS (use local *.module.css + var(--*)): ${offenders.join(", ")}`,
    );
  });
});

function walkSourceFiles(dir: string, base = ""): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkSourceFiles(full, rel));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".spec.ts")) {
      files.push(rel);
    }
  }
  return files;
}
