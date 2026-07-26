/**
 * Thin Shell Phase 4au — templatePreset capability + binder retirement.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getWorkspacePlugin as getDenaliPlugin } from "@app-cloud/workspace-denali";
import { resolveTemplatePresetCapability } from "@app-cloud/workspace-sdk";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("thin-shell-template-preset-capability — Phase 4au", () => {
  it("TS-4AU-01 denali publishes capabilities.templatePreset.buildFullTemplatePreset", () => {
    const plugin = getDenaliPlugin();
    const preset = resolveTemplatePresetCapability(plugin);
    assert.ok(preset);
    assert.equal(typeof preset.buildFullTemplatePreset, "function");
    const payload = preset.buildFullTemplatePreset("seed");
    assert.equal((payload as { seedLabel: string }).seedLabel, "seed");
    assert.ok(Array.isArray((payload as { steps: unknown[] }).steps));
  });

  it("TS-4AU-02 template-preset binder deleted; shell helper is capability-only", () => {
    const binder = resolve(
      WEB_ROOT,
      "src/bootstrap/workspace-wizard-template-preset-bindings.generated.ts"
    );
    assert.equal(existsSync(binder), false);

    const helper = readFileSync(
      resolve(WEB_ROOT, "src/features/settings/wizard-template-preset.ts"),
      "utf8"
    );
    const client = readFileSync(
      resolve(WEB_ROOT, "app/(app)/settings/tour-wizard-template/wizard-template-client.tsx"),
      "utf8"
    );

    assert.match(helper, /resolveTemplatePresetCapability/);
    assert.match(helper, /loadBootstrapWorkspacePlugin/);
    assert.doesNotMatch(helper, /workspace-wizard-template-preset-bindings/);

    assert.match(client, /@\/features\/settings\/wizard-template-preset/);
    assert.doesNotMatch(client, /workspace-wizard-template-preset-bindings/);
  });

  it("TS-4AU-03 shell helper loads preset via capability", async () => {
    const { loadFullWizardTemplatePreset } = await import(
      "../src/features/settings/wizard-template-preset"
    );
    const payload = await loadFullWizardTemplatePreset("denali", "تور تست");
    assert.equal(payload.seedLabel, "تور تست");
    assert.equal(payload.published, true);
    assert.ok(payload.steps && payload.steps.length > 0);
  });
});
