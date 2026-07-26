import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(WEB_ROOT, "..", "..");
const PACKAGE_JSON = join(WEB_ROOT, "package.json");
const SRC_DIR = join(WEB_ROOT, "src");
const APP_DIR = join(WEB_ROOT, "app");

const DENALI_SHELL_ORCHESTRATION = [
  "use-create-tour-wizard.ts",
  "use-flat-edit-page.ts",
  "wizard-draft-shell.ts",
  "flat-edit-form-shell.tsx",
] as const;

const WORKSPACE_LAZY_LOAD_ALLOWLIST = new Set([
  join(SRC_DIR, "bootstrap", "workspace-plugin-loaders.generated.ts"),
  join(SRC_DIR, "bootstrap", "workspace-wizard-message-loads.generated.ts"),
  join(SRC_DIR, "bootstrap", "workspace-theme-stylesheets.generated.ts"),
]);

function isWorkspaceProductImportAllowed(file: string): boolean {
  if (WORKSPACE_LAZY_LOAD_ALLOWLIST.has(file)) {
    return true;
  }
  const rel = file.slice(WEB_ROOT.length + 1);
  // Generated binders/loaders are the only remaining product fan-in path (manifest codegen).
  if (rel.includes(".generated.")) {
    return true;
  }
  return false;
}

const FORBIDDEN_IMPORT = [
  /from\s+['"][^'"]*workspaces\/denali/,
  /from\s+['"]@app-tour\/workspace-denali/,
  /require\s*\(\s*['"][^'"]*denali/,
  /import\s*\(\s*['"]@app-tour\/workspace-denali['"]\s*\)/,
  /from\s+['"][^'"]*workspaces\/urban/,
  /from\s+['"]@app-tour\/workspace-urban/,
  /require\s*\(\s*['"][^'"]*urban/,
  /import\s*\(\s*['"]@app-tour\/workspace-urban['"]\s*\)/,
];

function listSourceFiles(dir: string, out: string[] = []): string[] {
  if (!readdirSync(dir, { withFileTypes: true })) return out;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) listSourceFiles(p, out);
    else if (/\.(tsx?|jsx?)$/.test(ent.name)) out.push(p);
  }
  return out;
}

describe("Phase 3.3 workspace boundary", () => {
  it("has zero production dependencies on workspace product packages", () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8")) as {
      dependencies?: Record<string, string>;
    };
    for (const name of Object.keys(pkg.dependencies ?? {})) {
      assert.ok(!name.includes("denali"), `forbidden dependency: ${name}`);
      assert.ok(!name.includes("urban"), `forbidden dependency: ${name}`);
      assert.ok(!name.includes("workspaces/"), `forbidden workspaces dep: ${name}`);
    }
    assert.ok(!("@app-tour/workspace-denali" in (pkg.dependencies ?? {})));
    assert.ok(!("@app-tour/workspace-urban" in (pkg.dependencies ?? {})));
  });

  it("deprecated lazy-denali/urban plugin shims are removed", () => {
    const deprecated = [
      join(SRC_DIR, "bootstrap", "lazy-denali-plugin.ts"),
      join(SRC_DIR, "bootstrap", "lazy-urban-plugin.ts"),
    ];
    for (const file of deprecated) {
      assert.ok(!existsSync(file), `deprecated shim still present: ${file}`);
    }
  });

  it("source tree contains no product workspace imports outside lazy loaders", () => {
    const hits: string[] = [];
    for (const file of [...listSourceFiles(SRC_DIR), ...listSourceFiles(APP_DIR)]) {
      if (isWorkspaceProductImportAllowed(file)) continue;
      const src = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_IMPORT) {
        if (pattern.test(src)) hits.push(`${file}: ${pattern}`);
      }
    }
    assert.deepEqual(hits, []);
  });

  it("P14-2-T06 wizard-draft-envelope-hooks has no denali merge import", () => {
    const source = readFileSync(join(SRC_DIR, "wizard/wizard-draft-envelope-hooks.ts"), "utf8");
    assert.doesNotMatch(source, /resolve-denali-draft-merge/);
    assert.doesNotMatch(source, /@app-tour\/workspace-denali/);
  });

  it("P15-W-B1a platform create orchestrator uses shared gate hooks only", () => {
    const orchestrator = readFileSync(
      join(SRC_DIR, "wizard/workspace-create-tour-wizard-client.tsx"),
      "utf8"
    );
    assert.match(orchestrator, /useWizardTemplateGate/);
    assert.match(orchestrator, /useWizardCreateSeedPrefill/);
    assert.match(orchestrator, /useWizardCreatePresetPrefill/);
    assert.doesNotMatch(orchestrator, /resolveWizardTemplateGateState\(/);
    assert.doesNotMatch(orchestrator, /denali-catalog-sanitize/);
    assert.doesNotMatch(orchestrator, /getDenaliWorkspacePlugin/);
  });

  it("P15-W-B2 denali draft merge barrel is removed", () => {
    assert.ok(!existsSync(join(SRC_DIR, "draft/denali-wizard-draft-merge.ts")));
    assert.ok(!existsSync(join(SRC_DIR, "draft/resolve-denali-draft-merge.ts")));
    assert.ok(!existsSync(join(SRC_DIR, "draft/denali-wizard-resume-step.ts")));
    assert.ok(
      existsSync(join(REPO_ROOT, "packages/workspaces/denali/src/draft/resolve-denali-draft-merge.ts"))
    );
  });

  it("P15-W-B4 deprecated denali wizard shims are removed", () => {
    for (const rel of [
      "src/wizard/denali/denali-wizard-ui-context.ts",
      "src/wizard/denali/denali-wizard-conditional-logic.ts",
      "src/wizard/denali/denali-itinerary-types.ts",
      "src/features/settings/denali-fallback-settings-modules.ts",
      "src/wizard/denali/fetch-denali-destination-catalog.client.ts",
      "src/wizard/denali/use-denali-destination-catalog.ts",
      "src/wizard/denali/to-denali-flat-edit-tour-detail.ts",
      "src/exposure/denali-operator-surface-order.ts",
      "src/exposure/denali-workspace-surface-editor-state.ts",
      "src/exposure/DenaliWorkspaceSurfacesPanel.tsx",
    ]) {
      assert.ok(!existsSync(join(WEB_ROOT, rel)), `deprecated shim still present: ${rel}`);
    }
  });

  it("P15-W-B5 root layout loads theme CSS via dynamic admin loader", () => {
    assert.ok(!existsSync(join(SRC_DIR, "providers/workspace-theme-stylesheet.ts")));
    const layout = readFileSync(join(APP_DIR, "layout.tsx"), "utf8");
    assert.match(layout, /importAdminThemeForPlugin/);
    assert.match(layout, /await importAdminThemeForPlugin\(resolved\.session\.pluginId\)/);
    assert.doesNotMatch(layout, /@app-tour\/workspace-denali\/theme\/denali-admin\.css/);
    const generated = readFileSync(
      join(SRC_DIR, "bootstrap/workspace-theme-stylesheets.generated.ts"),
      "utf8"
    );
    assert.match(generated, /importAdminThemeForPlugin/);
    assert.match(generated, /resolveAdminThemeStylesheets/);
    assert.match(generated, /listAdminThemeRegistryPluginIds/);
    assert.doesNotMatch(generated, /export const WORKSPACE_ADMIN_THEME_REGISTRY/);
    assert.match(generated, /@app-tour\/workspace-denali\/theme\/denali-admin\.css/);
    assert.doesNotMatch(generated, /^import ["']@app-tour\/workspace-/m);
  });

  it("P15-W-B6 wizard media BFF paths are manifest-generated", () => {
    const generated = readFileSync(
      join(SRC_DIR, "bootstrap/wizard-media-route-bindings.generated.ts"),
      "utf8"
    );
    assert.match(generated, /"wizard-photos": "\/api\/wizard-media\/wizard-photos"/);
    assert.match(generated, /lookupWizardMediaRouteBffPath/);
    assert.doesNotMatch(generated, /export const WIZARD_MEDIA_ROUTE_BFF_PATHS/);
    const resolver = readFileSync(join(SRC_DIR, "wizard/resolve-wizard-media-bff-path.ts"), "utf8");
    assert.match(resolver, /lookupWizardMediaRouteBffPath/);
    assert.doesNotMatch(resolver, /WIZARD_MEDIA_ROUTE_BFF_PATHS/);
    assert.doesNotMatch(resolver, /MEDIA_ROUTE_KEY_TO_BFF/);
    const backendGenerated = readFileSync(
      join(SRC_DIR, "bootstrap/wizard-media-backend-route-bindings.generated.ts"),
      "utf8"
    );
    assert.match(backendGenerated, /upload: "\/tours\/wizard-photos"/);
    assert.match(backendGenerated, /lookupWizardMediaRouteBackendPaths/);
    assert.doesNotMatch(backendGenerated, /export const WIZARD_MEDIA_ROUTE_BACKEND_PATHS/);
    const backendResolver = readFileSync(
      join(SRC_DIR, "wizard/resolve-wizard-media-backend-path.ts"),
      "utf8"
    );
    assert.match(backendResolver, /lookupWizardMediaRouteBackendPaths/);
    assert.doesNotMatch(backendResolver, /WIZARD_MEDIA_ROUTE_BACKEND_PATHS/);
    assert.doesNotMatch(backendResolver, /MEDIA_ROUTE_KEY_TO_BACKEND/);
  });

  it("P15-W-C1 catalog readers import from workspace-denali package (web adapters allowed)", () => {
    const flatEditHook = readFileSync(
      join(SRC_DIR, "wizard/use-flat-edit-page.ts"),
      "utf8"
    );
    assert.match(flatEditHook, /wizard-flat-edit-chrome-registry/);
    assert.match(flatEditHook, /loadOperatorSubmitCatalogIds/);
    assert.equal(existsSync(join(SRC_DIR, "wizard/wizard-chrome-runtime.ts")), false);
    assert.ok(
      existsSync(
        join(REPO_ROOT, "packages/workspaces/denali/src/wizard/denali-wizard-catalog-sanitize.ts")
      )
    );
  });

  it("P15-W-C2 denali web adapters live via package surface + shell registry (no wizard/denali)", () => {
    assert.equal(existsSync(join(SRC_DIR, "wizard/denali")), false);
    assert.ok(existsSync(join(SRC_DIR, "wizard/resolve-wizard-workspace-plugin.ts")));
    assert.ok(existsSync(join(SRC_DIR, "wizard/wizard-host-adapter-registry.ts")));
    assert.ok(
      existsSync(
        join(REPO_ROOT, "packages/workspaces/denali/src/wizard/host-adapter-surface.ts")
      )
    );
    assert.ok(
      existsSync(
        join(REPO_ROOT, "packages/workspaces/denali/src/wizard/localize-denali-validation-message.ts")
      )
    );
    assert.equal(existsSync(join(SRC_DIR, "bootstrap/workspace-host-adapters.generated.ts")), false);
    assert.equal(
      existsSync(join(SRC_DIR, "bootstrap/workspace-wizard-create-chrome-bindings.generated.ts")),
      false
    );
    assert.equal(
      existsSync(join(SRC_DIR, "bootstrap/workspace-wizard-flat-edit-chrome-bindings.generated.ts")),
      false
    );
    assert.equal(
      existsSync(join(SRC_DIR, "bootstrap/workspace-wizard-flat-edit-form-bindings.generated.ts")),
      false
    );
    assert.equal(
      existsSync(join(SRC_DIR, "bootstrap/workspace-wizard-flat-edit-page-bindings.generated.ts")),
      false
    );
    assert.equal(
      existsSync(join(SRC_DIR, "bootstrap/workspace-wizard-create-view-bindings.generated.ts")),
      false
    );
    assert.equal(
      existsSync(join(SRC_DIR, "bootstrap/workspace-wizard-draft-shell-bindings.generated.ts")),
      false
    );
    assert.equal(
      existsSync(join(SRC_DIR, "bootstrap/workspace-wizard-template-gate-bindings.generated.ts")),
      false
    );
    assert.equal(
      existsSync(join(SRC_DIR, "bootstrap/workspace-operator-ui-components-bindings.generated.ts")),
      false
    );
    assert.equal(
      existsSync(join(SRC_DIR, "bootstrap/workspace-tour-action-submit-bindings.generated.ts")),
      false
    );
    assert.equal(
      existsSync(join(SRC_DIR, "bootstrap/wizard-label-bindings.generated.ts")),
      false
    );
    assert.equal(
      existsSync(join(SRC_DIR, "bootstrap/wizard-surface-bindings.generated.ts")),
      false
    );
    assert.equal(
      existsSync(join(SRC_DIR, "bootstrap/workspace-wizard-rules-bindings.generated.ts")),
      false
    );
    assert.equal(
      existsSync(join(SRC_DIR, "bootstrap/workspace-wizard-template-preset-bindings.generated.ts")),
      false
    );
    assert.equal(
      existsSync(join(SRC_DIR, "bootstrap/workspace-settings-hub-fallback-bindings.generated.ts")),
      false
    );
    assert.equal(
      existsSync(join(SRC_DIR, "bootstrap/workspace-wizard-template-editor-bindings.generated.ts")),
      false
    );
    assert.equal(
      existsSync(join(SRC_DIR, "bootstrap/workspace-tour-list-category-bindings.generated.ts")),
      false
    );
    assert.equal(
      existsSync(join(SRC_DIR, "bootstrap/workspace-photo-upload-errors-bindings.generated.ts")),
      false
    );
    const host = readFileSync(join(SRC_DIR, "wizard/workspace-wizard-host.tsx"), "utf8");
    assert.match(host, /loadRulesModule/);
    assert.doesNotMatch(host, /workspace-wizard-rules-bindings/);
    const draftShell = readFileSync(join(SRC_DIR, "wizard/wizard-draft-shell.ts"), "utf8");
    assert.match(draftShell, /resolveDraftShellCapability/);
    assert.match(draftShell, /createWizardDraftSessionIdForPlugin/);
    assert.doesNotMatch(draftShell, /workspace-wizard-draft-shell-bindings/);
    assert.doesNotMatch(draftShell, /export const DENALI_PLUGIN_ID/);
  });

  it("P15-W-C2 denali shell avoids self-referential @/wizard/denali imports", () => {
    for (const rel of [
      "wizard/use-create-tour-wizard.ts",
      "wizard/use-flat-edit-page.ts",
      "wizard/wizard-draft-shell.ts",
      "wizard/flat-edit-form-shell.tsx",
    ]) {
      const source = readFileSync(join(SRC_DIR, rel), "utf8");
      assert.doesNotMatch(source, /from "@\/wizard\/denali\//);
    }
    const binding = readFileSync(join(SRC_DIR, "wizard/wizard-draft-shell.ts"), "utf8");
    assert.match(binding, /resolveDraftShellCapability/);
    assert.doesNotMatch(binding, /workspace-wizard-draft-shell-bindings\.generated/);
    assert.equal(existsSync(join(SRC_DIR, "wizard/draft-shell-runtime.ts")), false);
    const flatEdit = readFileSync(join(SRC_DIR, "wizard/flat-edit-form-shell.tsx"), "utf8");
    assert.match(flatEdit, /wizard-flat-edit-form-registry/);
    const createClient = readFileSync(join(APP_DIR, "tours/new/create-tour-wizard-client.tsx"), "utf8");
    assert.match(createClient, /create-tour-wizard-client-ready/);
    const createReady = readFileSync(
      join(APP_DIR, "tours/new/create-tour-wizard-client-ready.tsx"),
      "utf8"
    );
    assert.match(createReady, /wizard-create-view-registry/);
    const flatEditClient = readFileSync(
      join(APP_DIR, "(app)/tours/[id]/edit/flat-edit-page-client.tsx"),
      "utf8"
    );
    assert.match(flatEditClient, /wizard-flat-edit-page-registry/);
    const flatEditHook = readFileSync(join(SRC_DIR, "wizard/use-flat-edit-page.ts"), "utf8");
    assert.match(flatEditHook, /wizard-flat-edit-chrome-registry/);
    assert.equal(existsSync(join(SRC_DIR, "wizard/wizard-chrome-runtime.ts")), false);
  });

  it("P15-W-C2 denali package fields use local adapters (no shell @/ imports)", () => {
    const DENALI_UI = join(REPO_ROOT, "packages/workspaces/denali/src/ui");
    assert.match(
      readFileSync(join(DENALI_UI, "fields/denali-destination-field.tsx"), "utf8"),
      /wizard-draft-edit/
    );
    assert.match(
      readFileSync(join(DENALI_UI, "fields/denali-destination-field.tsx"), "utf8"),
      /field-labels/
    );
    assert.match(
      readFileSync(join(DENALI_UI, "fields/denali-destination-field.tsx"), "utf8"),
      /i18n-errors/
    );
    assert.match(
      readFileSync(join(DENALI_UI, "fields/denali-gear-field.tsx"), "utf8"),
      /catalog-types/
    );
    assert.match(
      readFileSync(join(DENALI_UI, "fields/denali-elevation-gain-field.tsx"), "utf8"),
      /localized-numeric-input/
    );
    assert.match(
      readFileSync(join(DENALI_UI, "adapters/geocoding.ts"), "utf8"),
      /GeocodingSearchResult/
    );
    for (const name of DENALI_SHELL_ORCHESTRATION) {
      const source = readFileSync(join(SRC_DIR, "wizard", name), "utf8");
      assert.doesNotMatch(source, /from "@\/wizard\/use-latest-wizard-draft"/, name);
      assert.doesNotMatch(source, /from "@\/wizard\/denali\/wizard-labels"/, name);
      assert.doesNotMatch(source, /from "@\/i18n\/wizard-labels"/, name);
      assert.doesNotMatch(source, /from "@\/i18n\/resolve-coded-error-message"/, name);
      assert.doesNotMatch(source, /from "@\/i18n\/resolve-denali-photo-upload-error"/, name);
      if (name !== "use-flat-edit-page.ts") {
        assert.doesNotMatch(source, /from "@\/features\/settings\//, name);
      }
      assert.doesNotMatch(source, /from "@\/features\/users\//, name);
      if (name !== "flat-edit-form-shell.tsx") {
        assert.doesNotMatch(source, /from "@\/components\//, name);
      }
      assert.doesNotMatch(source, /from "@\/i18n\/routing"/, name);
      assert.doesNotMatch(source, /from "@\/i18n\/format-localized-digits"/, name);
      assert.doesNotMatch(source, /from "@\/lib\/geocoding\//, name);
    }
  });

  it("P15-W-C2b denali shell orchestration at wizard root without wizard/denali (T-096)", () => {
    assert.equal(existsSync(join(SRC_DIR, "wizard/denali")), false);
    for (const name of DENALI_SHELL_ORCHESTRATION) {
      assert.ok(existsSync(join(SRC_DIR, "wizard", name)), `missing ${name}`);
    }
  });

  it("P15-W-C2 denali @/ import budget stays within fast-gate ceiling", () => {
    let importCount = 0;
    for (const name of DENALI_SHELL_ORCHESTRATION) {
      const source = readFileSync(join(SRC_DIR, "wizard", name), "utf8");
      importCount += (source.match(/from "@\//g) ?? []).length;
    }
    assert.ok(importCount <= 42, `denali @/ imports=${importCount}, max=42`);
  });

  it("P15-W-B3 draft unification wiring is present (ops smoke remains manual)", () => {
    const binding = readFileSync(join(SRC_DIR, "wizard/wizard-draft-shell.ts"), "utf8");
    assert.match(binding, /resolveOperatorDraftConflictStrategy/);
    assert.match(binding, /draft-unification-v3-options/);
    const options = readFileSync(join(SRC_DIR, "draft/draft-unification-v3-options.ts"), "utf8");
    assert.match(options, /logTombstoneShadowMismatch/);
    assert.match(options, /resolveDraftShellCapability/);
    assert.doesNotMatch(options, /workspace-wizard-draft-unification-bindings/);
    assert.equal(
      existsSync(join(SRC_DIR, "bootstrap/workspace-wizard-draft-unification-bindings.generated.ts")),
      false
    );
    assert.ok(!existsSync(join(SRC_DIR, "draft/draft-unification-v3-shadow.ts")));
    assert.ok(existsSync(join(WEB_ROOT, "scripts/denali-draft-unification-smoke.mjs")));
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8")) as {
      scripts?: Record<string, string>;
    };
    assert.match(
      pkg.scripts?.["smoke:denali-draft-unification"] ?? "",
      /denali-draft-unification-smoke\.mjs/
    );
  });

  it("P0-T-161 denali package imports are confined to explicit allowlist", () => {
    const DENALI_IMPORT_PATTERNS = [
      /from\s+['"]@app-tour\/workspace-denali/,
      /import\s*\(\s*['"]@app-tour\/workspace-denali/,
      /require\s*\(\s*['"]@app-tour\/workspace-denali/,
    ];

    const hits: string[] = [];
    for (const file of [...listSourceFiles(SRC_DIR), ...listSourceFiles(APP_DIR)]) {
      if (file.endsWith(".generated.ts")) {
        continue;
      }
      const src = readFileSync(file, "utf8");
      if (!DENALI_IMPORT_PATTERNS.some((pattern) => pattern.test(src))) {
        continue;
      }
      if (!isWorkspaceProductImportAllowed(file)) {
        hits.push(file.slice(WEB_ROOT.length + 1));
      }
    }
    assert.deepEqual(hits, []);
  });
});
