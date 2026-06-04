/**
 * Phase 2 closure contracts (p2_phase2_contract_behaviors).
 * Cross-package visual-layer invariants — run from platform-core via REPO_ROOT.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(PKG_ROOT, "../..");

/** Minimum behavioral manifest rows (not a package test-count floor). */
export const PHASE_2_MIN_BEHAVIOR_CONTRACTS = 8;

export const PHASE_2_CLOSURE_CONTRACTS = [
  {
    id: "no-ui-primitives-barrel-export",
    title: "ui-primitives package.json has no barrel export (.)",
    guardIds: ["p2_phase2_contract_behaviors", "p2_ui_primitives_no_barrel"],
  },
  {
    id: "no-theme-react-internal-export",
    title: "theme-react must not export ./internal",
    guardIds: ["p2_phase2_contract_behaviors", "p2_theme_react_no_internal_export"],
  },
  {
    id: "platform-core-no-design-tokens",
    title: "platform-core must not reference design-tokens",
    guardIds: ["p2_phase2_contract_behaviors", "p2_platform_core_no_tokens"],
  },
  {
    id: "platform-core-no-visual-package-deps",
    title: "platform-core package.json has no ui-primitives or theme-react deps",
    guardIds: ["p2_phase2_contract_behaviors"],
  },
  {
    id: "no-barrel-ui-primitives-imports",
    title: "packages and apps must not import @app-tour/ui-primitives barrel",
    guardIds: ["p2_phase2_contract_behaviors"],
  },
  {
    id: "theme-react-index-no-harness-leak",
    title: "theme-react public index.ts does not re-export harness",
    guardIds: ["p2_phase2_contract_behaviors", "p2_theme_react_export_allowlist_l01"],
  },
  {
    id: "workspace-sdk-theme-css-safety",
    title: "workspace-sdk exposes theme CSS value safety for ingress",
    guardIds: ["p2_phase2_contract_behaviors"],
  },
  {
    id: "theme-react-single-public-export",
    title: "theme-react exports only root entry (.)",
    guardIds: ["p2_phase2_contract_behaviors", "p2_theme_react_export_allowlist_l01"],
  },
] as const;

const IMPORT_RE = /from\s+["']([^"']+)["']/g;
const BARREL_UI_PRIMITIVES_RE = /from\s+["']@app-tour\/ui-primitives["']/;

function readPkgJson(relPath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8")) as Record<
    string,
    unknown
  >;
}

function walkTsFiles(root: string, skipDirNames = new Set<string>()): string[] {
  const files: string[] = [];
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (skipDirNames.has(entry.name)) continue;
        walk(full);
        continue;
      }
      if (entry.isFile() && /\.(ts|tsx|mjs)$/.test(entry.name)) {
        files.push(full);
      }
    }
  }
  walk(root);
  return files;
}

describe("phase 2 closure contract", () => {
  it("declares phase-2 closure manifest with behavioral rows", () => {
    assert.equal(PHASE_2_CLOSURE_CONTRACTS.length, PHASE_2_MIN_BEHAVIOR_CONTRACTS);
    assert.ok(PHASE_2_CLOSURE_CONTRACTS.every((c) => c.guardIds.length > 0));
  });

  it("ui-primitives package.json has no barrel export", () => {
    const pkg = readPkgJson("packages/ui-primitives/package.json");
    const exports = (pkg.exports ?? {}) as Record<string, unknown>;
    assert.equal(Object.prototype.hasOwnProperty.call(exports, "."), false);
    assert.equal(pkg.main, undefined);
    assert.equal(pkg.types, undefined);
    assert.equal(
      fs.existsSync(path.join(REPO_ROOT, "packages/ui-primitives/dist/index.js")),
      false,
    );
  });

  it("theme-react package.json must not export ./internal", () => {
    const pkg = readPkgJson("packages/theme-react/package.json");
    const exports = (pkg.exports ?? {}) as Record<string, unknown>;
    assert.equal(Object.prototype.hasOwnProperty.call(exports, "./internal"), false);
  });

  it("platform-core must not reference design-tokens in package.json or src", () => {
    const pkgText = fs.readFileSync(
      path.join(REPO_ROOT, "packages/platform-core/package.json"),
      "utf8",
    );
    assert.equal(pkgText.includes("design-tokens"), false);
    const srcRoot = path.join(REPO_ROOT, "packages/platform-core/src");
    for (const file of walkTsFiles(srcRoot)) {
      const text = fs.readFileSync(file, "utf8");
      assert.equal(
        text.includes("design-tokens"),
        false,
        `${path.relative(REPO_ROOT, file)} must not reference design-tokens`,
      );
    }
  });

  it("platform-core package.json has no ui-primitives or theme-react dependencies", () => {
    const pkg = readPkgJson("packages/platform-core/package.json");
    const deps = {
      ...(pkg.dependencies as Record<string, string> | undefined),
      ...(pkg.devDependencies as Record<string, string> | undefined),
    };
    for (const name of Object.keys(deps)) {
      assert.equal(name.includes("ui-primitives"), false, `unexpected dep ${name}`);
      assert.equal(name.includes("theme-react"), false, `unexpected dep ${name}`);
    }
  });

  it("packages and apps must not import @app-tour/ui-primitives barrel", () => {
    const scanRoots = [
      path.join(REPO_ROOT, "packages"),
      path.join(REPO_ROOT, "apps"),
    ];
    const violations: string[] = [];
    for (const root of scanRoots) {
      if (!fs.existsSync(root)) continue;
      for (const file of walkTsFiles(root, new Set(["node_modules", "dist"]))) {
        if (file.includes("phase-2.contract.spec.ts")) continue;
        const text = fs.readFileSync(file, "utf8");
        if (BARREL_UI_PRIMITIVES_RE.test(text)) {
          violations.push(path.relative(REPO_ROOT, file));
        }
      }
    }
    assert.equal(
      violations.length,
      0,
      `barrel ui-primitives imports forbidden:\n${violations.join("\n")}`,
    );
  });

  it("theme-react public index.ts does not re-export harness", () => {
    const indexPath = path.join(REPO_ROOT, "packages/theme-react/src/index.ts");
    const text = fs.readFileSync(indexPath, "utf8");
    assert.equal(text.includes("/harness"), false);
    assert.equal(text.includes("harness/"), false);
  });

  it("workspace-sdk exposes theme CSS value safety for ingress", () => {
    const safetyPath = path.join(
      REPO_ROOT,
      "packages/workspace-sdk/src/theme/theme-css-value-safety.ts",
    );
    assert.ok(fs.existsSync(safetyPath));
    const safetyText = fs.readFileSync(safetyPath, "utf8");
    assert.ok(safetyText.includes("assertThemeCssValueIsSafe"));
    const mapValidationPath = path.join(
      REPO_ROOT,
      "packages/workspace-sdk/src/theme/css-map-validation.ts",
    );
    assert.ok(fs.existsSync(mapValidationPath));
    const ingressGuardPath = path.join(
      REPO_ROOT,
      "packages/theme-react/src/ingress/theme-ingress-guard.ts",
    );
    assert.ok(fs.existsSync(ingressGuardPath));
    assert.ok(
      fs.readFileSync(ingressGuardPath, "utf8").includes("validateWorkspaceThemeIngress"),
    );
  });

  it("theme-react exports only root entry in package.json", () => {
    const pkg = readPkgJson("packages/theme-react/package.json");
    const exportKeys = Object.keys((pkg.exports ?? {}) as Record<string, unknown>).sort();
    assert.deepEqual(exportKeys, ["."]);
  });

  it("no @app-tour/theme-react/internal imports in packages or apps", () => {
    const internalImportRe = /from\s+["']@app-tour\/theme-react\/internal["']/;
    const skipRel = new Set([
      "packages/platform-core/test/phase-2.contract.spec.ts",
      "packages/theme-react/scripts/verify-export-allowlist.mjs",
    ]);
    const violations: string[] = [];
    for (const root of [path.join(REPO_ROOT, "packages"), path.join(REPO_ROOT, "apps")]) {
      if (!fs.existsSync(root)) continue;
      for (const file of walkTsFiles(root, new Set(["node_modules", "dist"]))) {
        const rel = path.relative(REPO_ROOT, file);
        if (skipRel.has(rel)) continue;
        const text = fs.readFileSync(file, "utf8");
        if (internalImportRe.test(text)) {
          violations.push(rel);
        }
      }
    }
    assert.equal(
      violations.length,
      0,
      `theme-react/internal imports forbidden:\n${violations.join("\n")}`,
    );
  });
});
