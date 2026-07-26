/**
 * Thin Shell Phase 4bx — shell Operator-clean vs package Denali* naming inventory.
 * @see docs/dev/thin-shell-operator-naming-inventory.mdoc
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(WEB_ROOT, "../..");

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next" || name === "dist") continue;
      out.push(...walkTsFiles(full));
      continue;
    }
    if (name.endsWith(".ts") || name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

function isGeneratedBootstrap(rel: string): boolean {
  if (rel.includes(".generated.")) return true;
  if (rel.includes("/bootstrap/") && rel.includes("generated")) return true;
  return false;
}

describe("thin-shell-operator-naming-inventory — Phase 4bx", () => {
  it("TS-4BX-01 inventory doc locks shell-clean + deferred rename waves", () => {
    const doc = readFileSync(
      resolve(REPO_ROOT, "docs/dev/thin-shell-operator-naming-inventory.mdoc"),
      "utf8"
    );
    assert.match(doc, /Phase \*\*4bx\*\*/);
    assert.match(doc, /shell is Operator-named/i);
    assert.match(doc, /Architect YES/);
    assert.match(doc, /Forbidden/);
    assert.match(doc, /~310/);
  });

  it("TS-4BX-02 hand-written apps/web has no Denali* symbols or static denali imports", () => {
    const roots = [resolve(WEB_ROOT, "src"), resolve(WEB_ROOT, "app")];
    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of walkTsFiles(root)) {
        const rel = relative(WEB_ROOT, file).replace(/\\/g, "/");
        if (isGeneratedBootstrap(rel)) continue;
        if (rel.startsWith("test/") || rel.includes("/tests/")) continue;
        const src = readFileSync(file, "utf8");
        if (/\bDenali[A-Z]\w*/.test(src)) {
          offenders.push(`${rel}: Denali* symbol`);
        }
        if (/from\s+["']@app-tour\/workspace-denali/.test(src)) {
          offenders.push(`${rel}: static workspace-denali import`);
        }
        if (/import\s*\(\s*["']@app-tour\/workspace-denali/.test(src)) {
          offenders.push(`${rel}: dynamic workspace-denali import`);
        }
      }
    }
    assert.deepEqual(offenders, []);
  });

  it("TS-4BX-03 generated bootstrap may reference workspace-denali paths (§2.4)", () => {
    const loaders = readFileSync(
      resolve(WEB_ROOT, "src/bootstrap/workspace-plugin-loaders.generated.ts"),
      "utf8"
    );
    assert.match(loaders, /@app-tour\/workspace-denali/);
  });

  it("TS-4BX-04 remediation + SDK contracts reference 4bx inventory", () => {
    const remediation = readFileSync(
      resolve(REPO_ROOT, "docs/dev/saas-platform-remediation.mdoc"),
      "utf8"
    );
    assert.match(remediation, /Phase 4bx/);
    assert.match(remediation, /thin-shell-operator-naming-inventory\.mdoc/);

    const contracts = readFileSync(
      resolve(REPO_ROOT, "packages/workspace-sdk/SDK_CONTRACTS.md"),
      "utf8"
    );
    assert.match(contracts, /Package Operator naming \(Phase 4bx\)/);
  });
});
