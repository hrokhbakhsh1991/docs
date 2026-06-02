import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateDefaultValues } from "../../schemas/denaliCore.schema";
import { denaliTemplateOrchestratorFactory } from "./DenaliTemplateOrchestratorFactory";

test("createDraftFromTemplate returns Postgres-compatible draft snapshot on success", async () => {
  const result = await denaliTemplateOrchestratorFactory.createDraftFromTemplate({
    workspaceId: "ws-1",
    templateId: "tpl-1",
    canonicalData: {
      category: "mountain",
      duration: "single",
      title: "Headless template tour",
      program: { shortDescription: "Short", themeIds: [] },
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.draftState.version, 0);
  assert.equal(result.draftState.schemaVersion, 1);
  assert.ok(result.draftState.data.form);
  assert.equal(typeof result.draftState.data.currentStepIndex, "number");
  assert.equal(result.payload.title, "Headless template tour");
});

test("createDraftFromTemplate rejects invalid canonicalData at Layer A boundary", async () => {
  const result = await denaliTemplateOrchestratorFactory.createDraftFromTemplate({
    workspaceId: "ws-1",
    templateId: "tpl-1",
    canonicalData: "not-an-object" as unknown as Record<string, unknown>,
  });

  assert.equal(result.success, false);
  assert.equal(result.failureKind, "canonical_validation");
  assert.ok(result.validationIssues?.length);
  assert.ok(result.errors?.length);
});

test("createDraftFromTemplate respects defaultValues override", async () => {
  const defaults = buildDenaliTourCreateDefaultValues();
  const result = await denaliTemplateOrchestratorFactory.createDraftFromTemplate(
    {
      workspaceId: "ws-1",
      templateId: "tpl-1",
      canonicalData: {
        title: "Override title",
        program: { shortDescription: "Short", themeIds: [] },
      },
    },
    { defaultValues: defaults },
  );

  assert.equal(result.success, true);
  const form = result.draftState.data.form as { basicInfo?: { title?: string } };
  assert.equal(form.basicInfo?.title, "Override title");
});

test("createDraftFromTemplate succeeds with empty canonicalData using registry defaults", async () => {
  const result = await denaliTemplateOrchestratorFactory.createDraftFromTemplate({
    workspaceId: "ws-1",
    templateId: "tpl-1",
    canonicalData: {},
  });

  assert.equal(result.success, true);
  assert.equal(result.draftState.version, 0);
  assert.ok(result.draftState.data.form);
  assert.equal(typeof result.draftState.data.currentStepIndex, "number");
});
