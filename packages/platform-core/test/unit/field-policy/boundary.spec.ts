import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const FORBIDDEN_PATTERNS = [
  /\btelegram\b/i,
  /\bemail\b/i,
  /\bsms\b/i,
  /\bslack\b/i,
  /\bwhatsapp\b/i,
  /\btemplate\b/i,
  /\bformatter\b/i,
  /\bFieldEventTrigger\b/,
  /\bFieldDeliveryTarget\b/,
  /\bFieldTimingRule\b/,
  /apps\/api/,
  /workspaces\/d[e]nali/,
  /kind:\s*["']all["']/,
  /kind:\s*["']any["']/,
  /kind:\s*["']not["']/,
  /kind:\s*["']script["']/,
  /integrations\.telegram/i,
  /\bproviderId\b/,
] as const;

function listSourceFiles(directory: string): readonly string[] {
  const entries = readdirSync(directory);
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      files.push(...listSourceFiles(path));
    } else if (entry.endsWith(".ts")) {
      files.push(path);
    }
  }

  return files;
}

describe("field-policy boundaries", () => {
  it("does not reference providers, delivery formatting, or workspace-specific code", () => {
    const sourceRoot = join(process.cwd(), "src", "field-policy");
    const violations: string[] = [];

    for (const file of listSourceFiles(sourceRoot)) {
      const text = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(text)) {
          violations.push(`${file}: ${pattern}`);
        }
      }
    }

    assert.deepEqual(violations, []);
  });
});
