/**
 * Phase 14.4 — Urban create orchestrator smoke
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { getUrbanWorkspacePlugin } from "@app-tour/workspace-urban/plugin";

const ORCHESTRATOR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../src/wizard/workspace-create-tour-wizard-client.tsx"
);

describe("urban-wizard-create-smoke.spec.ts (P14-4-T03)", () => {
  it("P14-4-03a orchestrator has no denali-only imports", () => {
    const source = readFileSync(ORCHESTRATOR, "utf8");
    assert.doesNotMatch(source, /denali-catalog-sanitize/);
    assert.doesNotMatch(source, /getDenaliWorkspacePlugin/);
    assert.match(source, /WorkspaceCreateTourWizardClient/);
  });

  it("P14-4-03b urban plugin exposes validateDraftSync and urban message namespace", () => {
    const plugin = getUrbanWorkspacePlugin();
    assert.equal(plugin.wizardHost?.wizardMessageNamespace, "urban");
    assert.equal(typeof plugin.wizardHost?.validateDraftSync, "function");
    const result = plugin.wizardHost?.validateDraftSync?.({
      plugin,
      draft: { data: { tour: { title: "City walk" } } },
      rulesModule: null,
      tenantId: "urban-smoke-tenant",
    });
    assert.ok(result);
  });

  it("P14-4-03c urban plugin uses platform validation surface", () => {
    const plugin = getUrbanWorkspacePlugin();
    assert.equal(plugin.wizardHost?.validationSurfaceId, "platform");
    assert.equal(plugin.wizardHost?.usesStepValidation, true);
  });

  it("P14-4-03d orchestrator uses draft sync for platform create", () => {
    const source = readFileSync(ORCHESTRATOR, "utf8");
    assert.match(source, /PLATFORM_OPERATOR_WIZARD_DRAFT_NAMESPACE/);
  });
});
