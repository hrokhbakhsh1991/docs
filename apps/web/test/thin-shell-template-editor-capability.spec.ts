/**
 * Thin Shell Phase 4aw — templateEditor capability + binder retirement.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getWorkspacePlugin as getDenaliPlugin } from "@app-tour/workspace-denali";
import { resolveTemplateEditorCapability } from "@app-tour/workspace-sdk";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("thin-shell-template-editor-capability — Phase 4aw", () => {
  it("TS-4AW-01 denali publishes capabilities.templateEditor surface", () => {
    const plugin = getDenaliPlugin();
    const editor = resolveTemplateEditorCapability(plugin);
    assert.ok(editor);
    assert.equal(typeof editor.messageNamespace, "string");
    assert.equal(typeof editor.isFrozenTemplateCanonicalPath, "function");
    assert.equal(typeof editor.normalizePublishedPayloadSteps, "function");
  });

  it("TS-4AW-02 template-editor binder deleted; registry is capability-only", () => {
    const binder = resolve(
      WEB_ROOT,
      "src/bootstrap/workspace-wizard-template-editor-bindings.generated.ts"
    );
    assert.equal(existsSync(binder), false);

    const registry = readFileSync(
      resolve(WEB_ROOT, "src/wizard/wizard-template-editor-registry.ts"),
      "utf8"
    );
    const client = readFileSync(
      resolve(WEB_ROOT, "app/(app)/settings/tour-wizard-template/wizard-template-client.tsx"),
      "utf8"
    );

    assert.match(registry, /resolveTemplateEditorCapability/);
    assert.match(registry, /app-cloud\.wizardTemplateEditorCache/);
    assert.doesNotMatch(registry, /workspace-wizard-template-editor-bindings/);
    assert.doesNotMatch(registry, /@app-cloud\/workspace-denali/);

    assert.match(client, /wizard-template-editor-registry/);
    assert.doesNotMatch(client, /workspace-wizard-template-editor-bindings/);
  });

  it("TS-4AW-03 ensure + sync resolve publish editor under denali plugin id", async () => {
    const { ensureWizardTemplateEditor, resolveWizardTemplateEditor } = await import(
      "../src/wizard/wizard-template-editor-registry"
    );
    const warmed = await ensureWizardTemplateEditor("denali");
    assert.ok(warmed);
    assert.equal(typeof warmed.resolveCatalogFieldMeta, "function");
    assert.equal(resolveWizardTemplateEditor("denali"), warmed);
  });
});
