/**
 * Thin Shell Phase 4t — hand-written shell must not read bare plugin.wizardHost.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_ROOTS = [join(WEB_ROOT, "src"), join(WEB_ROOT, "app")];

const BARE_WIZARD_HOST =
  /(?:plugin|workspacePlugin)\s*\?\.\s*wizardHost|(?:plugin|workspacePlugin)\.wizardHost\b/;

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist") continue;
      walkTsFiles(full, out);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name)) continue;
    if (name.includes(".generated.")) continue;
    if (/\.spec\.(ts|tsx)$/.test(name)) continue;
    out.push(full);
  }
  return out;
}

describe("thin-shell-resolve-wizard-host — Phase 4t", () => {
  it("TS-4T-01 hand-written apps/web has no bare plugin.wizardHost reads", () => {
    const hits: string[] = [];
    for (const root of SCAN_ROOTS) {
      for (const file of walkTsFiles(root)) {
        const source = readFileSync(file, "utf8");
        const lines = source.split(/\r?\n/);
        lines.forEach((line, index) => {
          // Allow comments that mention the legacy path in migration notes.
          const trimmed = line.trim();
          if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
            return;
          }
          if (BARE_WIZARD_HOST.test(line)) {
            hits.push(`${file.replace(WEB_ROOT + "/", "")}:${index + 1}:${trimmed}`);
          }
        });
      }
    }
    assert.deepEqual(hits, []);
  });

  it("TS-4T-02 key wizard modules import resolveWizardHostCapability", () => {
    const required = [
      "src/wizard/workspace-wizard-host.tsx",
      "src/wizard/wizard-draft-envelope-hooks.ts",
      "src/wizard/workspace-create-tour-wizard-client.tsx",
      "src/tours/tour-edit-hydrate-logic.ts",
      "src/tours/wizard-template-gate-logic.ts",
    ];
    for (const rel of required) {
      const source = readFileSync(join(WEB_ROOT, rel), "utf8");
      assert.match(source, /resolveWizardHostCapability/, rel);
    }
  });
});
