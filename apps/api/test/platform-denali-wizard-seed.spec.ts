import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform denali wizard seed on create", () => {
  const seedSource = readFileSync(
    new URL("../src/settings/seed-workspace-wizard-template.ts", import.meta.url),
    "utf8"
  );
  const bindingsSource = readFileSync(
    new URL("../src/settings/workspace-dev-bootstrap-bindings.generated.ts", import.meta.url),
    "utf8"
  );
  const denaliTemplateSource = readFileSync(
    new URL("../../../packages/workspaces/denali/src/settings/denaliFullWizardTemplate.ts", import.meta.url),
    "utf8"
  );
  const sagaSource = readFileSync(
    new URL("../src/platform/provision-tenant-saga.ts", import.meta.url),
    "utf8"
  );

  it("published", () => {
    assert.match(seedSource, /payload\.published === true/);
    assert.match(bindingsSource, /minPublishedSteps:\s*6/);
    assert.match(denaliTemplateSource, /published:\s*true/);
    assert.match(sagaSource, /seedWorkspaceWizardTemplateInTransaction/);
  });

  it("stepIds exist", () => {
    const stepIdCount = denaliTemplateSource.split("stepId:").length - 1;
    assert.ok(stepIdCount >= 6, `expected 6+ stepId entries, got ${stepIdCount}`);
  });
});
