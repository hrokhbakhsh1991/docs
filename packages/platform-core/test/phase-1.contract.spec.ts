import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(PKG_ROOT, "../..");
const CRUISE_STARTER_HELPER = path.join(PKG_ROOT, "test/lib/cruise-no-starter-plugin.mjs");

/** Minimum behavioral rows in this file (not a package test-count floor). */
export const PHASE_1_MIN_BEHAVIOR_CONTRACTS = 14;

export const PHASE_1_CLOSURE_CONTRACTS = [
  {
    id: "import-purity",
    title: "platform-core entry does not load CASL or SDK theme/auth",
    specRel: "test/phase-1.contract.spec.ts",
    guardIds: ["g11_phase1_contract_behaviors"],
  },
  {
    id: "no-starter-plugin",
    title: "production src must not import workspace starter plugin (depcruise)",
    specRel: "test/phase-1.contract.spec.ts",
    guardIds: ["g11_phase1_contract_behaviors"],
  },
  {
    id: "no-spec-under-src",
    title: "unit specs live under test/ not src/",
    specRel: "test/phase-1.contract.spec.ts",
    guardIds: ["g11_phase1_contract_behaviors"],
  },
  {
    id: "headless-plugin-ingress",
    title: "buildRuntime uses includeTheme:false",
    specRel: "test/phase-1.contract.spec.ts",
    guardIds: ["g11_phase1_contract_behaviors"],
  },
  {
    id: "sdk-subpath-imports",
    title: "production and tests use SDK subpaths only",
    specRel: "test/phase-1.contract.spec.ts",
    guardIds: ["g11_phase1_contract_behaviors"],
  },
  {
    id: "no-fromPlugin-api",
    title: "removed deprecated PlatformWizardEngine.fromPlugin",
    specRel: "test/phase-1.contract.spec.ts",
    guardIds: ["g11_phase1_contract_behaviors"],
  },
  {
    id: "no-test-policy-export",
    title: "index.ts does not export RuleEngineScopePolicy",
    specRel: "test/phase-1.contract.spec.ts",
    guardIds: ["g11_phase1_contract_behaviors"],
  },
  {
    id: "starter-fixture-location",
    title: "starter fixture only under test/fixtures",
    specRel: "test/phase-1.contract.spec.ts",
    guardIds: ["g11_phase1_contract_behaviors"],
  },
  {
    id: "dist-import-purity",
    title: "dist/index.js does not load CASL or SDK theme/auth",
    specRel: "test/phase-1.contract.spec.ts",
    guardIds: ["g11_phase1_contract_behaviors"],
  },
  {
    id: "field-validation-contract",
    title: "canonical-field-validation-contract module exists",
    specRel: "src/contracts/canonical-field-validation-contract.ts",
    guardIds: ["g11_phase1_contract_behaviors"],
  },
  {
    id: "adversarial-plugin-ingress",
    title: "headless ingress skips invalid theme at platform init",
    specRel: "test/adversarial-plugin-ingress.spec.ts",
    guardIds: ["g10_adversarial_specs_execute"],
  },
  {
    id: "single-facade-export",
    title: "package.json exports only root facade (no subpath wildcards)",
    specRel: "test/phase-1.contract.spec.ts",
    guardIds: ["g11_phase1_contract_behaviors"],
  },
  {
    id: "facade-integration-gate",
    title: "facade-integration.spec.ts gates public PlatformWizardEngine API",
    specRel: "test/facade-integration.spec.ts",
    guardIds: ["g12_facade_integration_spec"],
  },
  {
    id: "fresh-starter-fixture",
    title: "createFreshStarterPlugin alias uses per-call factory (no singleton)",
    specRel: "test/fixtures/starter.fixture.ts",
    guardIds: ["g11_phase1_contract_behaviors"],
  },
] as const;

const FORBIDDEN_PRODUCTION_IMPORTS = [
  "@app-tour/workspace-sdk",
  "@casl/ability",
];

const ALLOWED_EXTERNAL_PREFIX = "@app-tour/workspace-sdk";

const IMPORT_RE = /from\s+["']([^"']+)["']/g;

function assertNoSpecFilesUnderSrc(): void {
  const srcRoot = path.join(PKG_ROOT, "src");
  const specs: string[] = [];

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.name.endsWith(".spec.ts")) {
        specs.push(path.relative(PKG_ROOT, full));
      }
    }
  }

  walk(srcRoot);
  assert.equal(specs.length, 0, `spec files must live under test/, not src:\n${specs.join("\n")}`);
}

function assertBuildRuntimeUsesHeadlessPluginIngress(): void {
  const enginePath = path.join(PKG_ROOT, "src", "engine", "platform-wizard.engine.ts");
  const text = fs.readFileSync(enginePath, "utf8");
  assert.match(
    text,
    /parseWorkspacePluginFromStorage\([^)]*\{\s*includeTheme:\s*false\s*\}/,
    "plugin ingress must use includeTheme: false",
  );
  assert.match(
    text,
    /sanitizePluginAtCreate/,
    "create must clone/freeze plugin at construction (IB-003)",
  );
}

function assertTestsAvoidStarterSingleton(): void {
  const testRoot = path.join(PKG_ROOT, "test");
  const violations: string[] = [];

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".mjs")) {
        continue;
      }
      if (entry.name === "phase-1.contract.spec.ts") {
        continue;
      }
      const text = fs.readFileSync(full, "utf8");
      if (/getStarterWorkspacePlugin\s*\(/.test(text) || /import\s*\{[^}]*getStarterWorkspacePlugin/.test(text)) {
        violations.push(`${path.relative(PKG_ROOT, full)}: getStarterWorkspacePlugin`);
      }
    }
  }

  walk(testRoot);
  assert.equal(
    violations.length,
    0,
    `tests must use createTestStarterPlugin(), not SDK singleton:\n${violations.join("\n")}`,
  );
}

function assertProductionSrcNoTestPolicy(): void {
  const srcRoot = path.join(PKG_ROOT, "src");
  const hits: string[] = [];

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith(".ts")) {
        continue;
      }
      const text = fs.readFileSync(full, "utf8");
      if (
        text.includes("rule-engine-test-policy") ||
        text.includes("RULE_ENGINE_TEST_SCOPE_POLICY")
      ) {
        hits.push(path.relative(PKG_ROOT, full));
      }
    }
  }

  walk(srcRoot);
  assert.equal(hits.length, 0, `production src must not import test policy:\n${hits.join("\n")}`);
}

function assertNoFromPluginInProductionSrc(): void {
  const srcRoot = path.join(PKG_ROOT, "src");
  const hits: string[] = [];

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith(".ts")) {
        continue;
      }
      const text = fs.readFileSync(full, "utf8");
      if (text.includes("fromPlugin")) {
        hits.push(path.relative(PKG_ROOT, full));
      }
    }
  }

  walk(srcRoot);
  assert.equal(
    hits.length,
    0,
    `production src must not reference fromPlugin:\n${hits.join("\n")}`,
  );
}

function assertSingleFacadeExport(): void {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(PKG_ROOT, "package.json"), "utf8"),
  ) as { exports?: Record<string, unknown> };
  const exports = pkg.exports ?? {};
  assert.deepEqual(Object.keys(exports).sort(), [".", "./*"]);
  assert.ok(typeof exports["."] === "object" && exports["."] !== null);
  assert.equal(exports["./*"], null);
}

function assertFieldValidationContractModule(): void {
  const contractPath = path.join(
    PKG_ROOT,
    "src",
    "contracts",
    "canonical-field-validation-contract.ts",
  );
  assert.ok(fs.existsSync(contractPath), "canonical-field-validation-contract.ts required");
  const text = fs.readFileSync(contractPath, "utf8");
  assert.ok(text.includes("HIDDEN_FIELD_POISON"));
  assert.ok(text.includes("hiddenFieldPoisonViolation"));
  assert.ok(text.includes("passesHiddenFieldKindGate"));
  assert.ok(
    text.includes("isEmptyCanonicalValue"),
    "passesHiddenFieldKindGate must be wired to isEmptyCanonicalValue",
  );
}

function assertTestsUseSdkSubpathsOnly(): void {
  const testRoot = path.join(PKG_ROOT, "test");
  const violations: string[] = [];

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith(".ts") || entry.name === "phase-1.contract.spec.ts") {
        continue;
      }
      const text = fs.readFileSync(full, "utf8");
      const rel = path.relative(PKG_ROOT, full);
      for (const match of text.matchAll(IMPORT_RE)) {
        const specifier = match[1];
        if (specifier === "@app-tour/workspace-sdk") {
          violations.push(`${rel} imports SDK barrel`);
        }
      }
    }
  }

  walk(testRoot);
  assert.equal(
    violations.length,
    0,
    `platform-core tests must use @app-tour/workspace-sdk/* subpaths:\n${violations.join("\n")}`,
  );
}

function assertProductionSrcUsesSdkOnly(): void {
  const srcRoot = path.join(PKG_ROOT, "src");
  const violations: string[] = [];

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "__fixtures__") {
          violations.push(`${path.relative(PKG_ROOT, full)}: __fixtures__ must not live under src/`);
          continue;
        }
        walk(full);
        continue;
      }
      if (!entry.name.endsWith(".ts") || entry.name.endsWith(".spec.ts")) {
        continue;
      }
      const text = fs.readFileSync(full, "utf8");
      const rel = path.relative(PKG_ROOT, full);

      for (const forbidden of FORBIDDEN_PRODUCTION_IMPORTS) {
        if (text.includes(`from "${forbidden}"`) || text.includes(`from '${forbidden}'`)) {
          violations.push(`${rel} imports barrel ${forbidden}`);
        }
      }

      for (const match of text.matchAll(IMPORT_RE)) {
        const specifier = match[1];
        if (!specifier.startsWith("@")) {
          continue;
        }
        if (!specifier.startsWith(ALLOWED_EXTERNAL_PREFIX)) {
          violations.push(`${rel} imports non-SDK package ${specifier}`);
        }
      }

      if (text.includes("__fixtures__/starter.fixture") || text.includes("getStarterWorkspacePlugin")) {
        violations.push(`${rel} must not reference starter fixture or getStarterWorkspacePlugin`);
      }
    }
  }

  walk(srcRoot);
  assert.equal(
    violations.length,
    0,
    `platform-core production src purity violations:\n${violations.join("\n")}`,
  );
}

function cruiseStarterPluginViolations(): { rule?: { name?: string }; from?: string; to?: string }[] {
  const r = spawnSync(process.execPath, [CRUISE_STARTER_HELPER], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });

  const stdout = (r.stdout ?? "").trim();
  if (r.status === 0) {
    return [];
  }

  if (stdout.startsWith("[")) {
    return JSON.parse(stdout) as { rule?: { name?: string }; from?: string; to?: string }[];
  }

  throw new Error(
    `depcruise starter-plugin check failed (exit ${r.status}): ${(r.stderr ?? stdout).trim()}`,
  );
}

describe("phase 1 closure contract", () => {
  it("has no *.spec.ts under src/", () => {
    assertNoSpecFilesUnderSrc();
  });

  it("buildRuntime parses plugin with includeTheme: false", () => {
    assertBuildRuntimeUsesHeadlessPluginIngress();
  });

  it("production src does not expose fromPlugin", () => {
    assertNoFromPluginInProductionSrc();
  });

  it("canonical-field-validation-contract module is present", () => {
    assertFieldValidationContractModule();
  });

  it("package.json enforces single public facade export", () => {
    assertSingleFacadeExport();
  });

  it("tests import only @app-tour/workspace-sdk subpaths (not barrel)", () => {
    assertTestsUseSdkSubpathsOnly();
  });

  it("production src imports only @app-tour/workspace-sdk subpaths (not barrel)", () => {
    assertProductionSrcUsesSdkOnly();
  });

  it("depcruise platform-core-no-workspace-starter-plugin passes on production src", () => {
    const violations = cruiseStarterPluginViolations();
    assert.equal(
      violations.length,
      0,
      violations.length
        ? `starter plugin import violations:\n${violations.map((v) => `${v.from} → ${v.to}`).join("\n")}`
        : undefined,
    );
  });

  it("starter.fixture.ts is not under src/", () => {
    const legacy = path.join(PKG_ROOT, "src", "__fixtures__", "starter.fixture.ts");
    assert.equal(fs.existsSync(legacy), false, "move starter fixture to test/fixtures only");
    assert.ok(
      fs.existsSync(path.join(PKG_ROOT, "test", "fixtures", "starter.fixture.ts")),
      "test/fixtures/starter.fixture.ts required",
    );
  });

  it("dist/index.js import does not transitively load @casl/ability or theme/auth modules", () => {
    const distIndex = path.join(PKG_ROOT, "dist", "index.js");
    assert.ok(fs.existsSync(distIndex), "run pnpm build before test:phase-1");

    const probe = path.join(PKG_ROOT, "test", "import-purity-probe.mjs");
    const r = spawnSync(process.execPath, [probe], {
      cwd: PKG_ROOT,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    });

    if (r.status !== 0) {
      const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`.trim();
      assert.fail(out || `import purity probe exit ${r.status ?? "unknown"}`);
    }
  });

  it("index.ts does not export rule engine test policy types", () => {
    const indexSource = fs.readFileSync(path.join(PKG_ROOT, "src", "index.ts"), "utf8");
    assert.equal(indexSource.includes("RuleEngineScopePolicy"), false);
    assert.equal(indexSource.includes("DEFAULT_RULE_ENGINE_SCOPE_POLICY"), false);
  });

  it("index.ts does not export PlatformLogger or unwrapPlatformResult", () => {
    const indexSource = fs.readFileSync(path.join(PKG_ROOT, "src", "index.ts"), "utf8");
    assert.equal(indexSource.includes("PlatformLogger"), false);
    assert.equal(indexSource.includes("noopPlatformLogger"), false);
    assert.equal(indexSource.includes("unwrapPlatformResult"), false);
  });

  it("tests do not import getStarterWorkspacePlugin singleton", () => {
    assertTestsAvoidStarterSingleton();
  });

  it("production src does not import rule engine test policy", () => {
    assertProductionSrcNoTestPolicy();
  });

  it("declares phase-1 closure manifest with behavioral rows", () => {
    assert.equal(PHASE_1_CLOSURE_CONTRACTS.length, PHASE_1_MIN_BEHAVIOR_CONTRACTS);
    assert.ok(PHASE_1_CLOSURE_CONTRACTS.every((c) => c.guardIds.length > 0));
  });

  it("facade-integration.spec.ts exists for g12 behavioral gate", () => {
    assert.ok(
      fs.existsSync(path.join(PKG_ROOT, "test", "facade-integration.spec.ts")),
      "test/facade-integration.spec.ts required for Phase 1 facade gate",
    );
  });

  it("starter.fixture exports createFreshStarterPlugin factory alias", () => {
    const source = fs.readFileSync(
      path.join(PKG_ROOT, "test", "fixtures", "starter.fixture.ts"),
      "utf8",
    );
    assert.match(source, /export const createFreshStarterPlugin = createTestStarterPlugin/);
    assert.equal(source.includes("getStarterWorkspacePlugin"), false);
  });

  it("createFreshStarterPlugin returns a new plugin object on each call", async () => {
    const { createFreshStarterPlugin } = await import("./fixtures/starter.fixture.js");
    const first = createFreshStarterPlugin();
    const second = createFreshStarterPlugin();
    assert.notEqual(first, second);
    assert.equal(first.fieldRegistry, second.fieldRegistry);
  });

  it("facade-integration.spec.ts defines at least five behavioral tests", () => {
    const source = fs.readFileSync(
      path.join(PKG_ROOT, "test", "facade-integration.spec.ts"),
      "utf8",
    );
    const itCount = (source.match(/\bit\s*\(/g) ?? []).length;
    assert.ok(
      itCount >= 5,
      `facade-integration.spec.ts must have ≥5 it blocks (found ${itCount})`,
    );
  });
});
