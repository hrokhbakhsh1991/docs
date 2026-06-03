import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PlatformWizardEngine } from "../src/engine/platform-wizard.engine.js";
import { PlatformCoreError } from "../src/errors/platform-core.error.js";
import { createTestStarterPlugin } from "./fixtures/starter.fixture.js";
import { STARTER_PLAN_SNAPSHOT } from "./fixtures/starter-plan-golden.js";

describe("platform-core cold start", () => {
  it("create does not build the plugin graph", () => {
    const engine = PlatformWizardEngine.create(createTestStarterPlugin());
    assert.equal(engine.isInitialized(), false);
  });

  it("init is idempotent and guarded against duplicate graph builds", () => {
    const engine = PlatformWizardEngine.create(createTestStarterPlugin());
    engine.init();
    assert.equal(engine.isInitialized(), true);
    engine.init();
    assert.equal(engine.isInitialized(), true);
  });

  it("fresh engine succeeds after a separate instance failed at create", () => {
    assert.throws(
      () =>
        PlatformWizardEngine.create({
          ...createTestStarterPlugin(),
          fieldRegistry: { version: 1, fields: [] },
        }),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        return true;
      },
    );
    const fresh = PlatformWizardEngine.create(createTestStarterPlugin());
    assert.equal(fresh.tryInit().ok, true);
    assert.equal(fresh.isInitialized(), true);
  });

  it("invalid plugin fails at create without pinning class-level init state", () => {
    const broken = {
      ...createTestStarterPlugin(),
      ruleSet: {
        ...createTestStarterPlugin().ruleSet,
        defaultCellId: "__missing__",
      },
    };
    assert.throws(() => PlatformWizardEngine.createForTests(broken));
    assert.throws(() => PlatformWizardEngine.createForTests(broken));
    const ok = PlatformWizardEngine.create(createTestStarterPlugin());
    assert.equal(ok.tryInit().ok, true);
  });

  it("buildRenderPlan lazily initializes once", () => {
    const engine = PlatformWizardEngine.create(createTestStarterPlugin());
    assert.equal(engine.isInitialized(), false);
    const plan = engine.buildRenderPlan({
      tenantId: "tenant-cold-start",
      dimensions: { variant: "default" },
    });
    assert.ok(plan.length >= 1);
    assert.equal(engine.isInitialized(), true);
    engine.buildRenderPlan({
      tenantId: "tenant-cold-start",
      dimensions: { variant: "default" },
    });
    assert.equal(engine.isInitialized(), true);
  });

  it("lazy buildRenderPlan matches starter golden plan hash after first init", () => {
    const engine = PlatformWizardEngine.create(createTestStarterPlugin());
    const plan = engine.buildRenderPlan({
      tenantId: "tenant-cold-golden",
      dimensions: { variant: "default" },
    });
    assert.equal(JSON.stringify(plan), STARTER_PLAN_SNAPSHOT);
    assert.equal(engine.isInitialized(), true);
  });
});
