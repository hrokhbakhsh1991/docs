/**
 * Settings orchestrate path must match backend instantiate orchestrator (single SOT).
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  denaliCanonicalToForm,
  denaliTemplateOrchestratorFactory,
  listDenaliTemplateStorageFieldPaths,
} from "@repo/denali-domain";
import { resolveModernTemplateBuilderFieldPaths } from "../../app/(app)/settings/tour-wizard-template/tour-wizard-template-section-groups";
import { buildDenaliTourCreateDefaultValues } from "../../src/features/tours/wizard/schemas/denaliCore.schema";
import { orchestrateDenaliWizardFromTemplate } from "../../src/features/tours/wizard/domain/orchestrateDenaliWizardFromTemplate";
import {
  canonicalDataFromWizardForm,
  DENALI_TEMPLATE_SEED_COMPOSITE_ZOD_KINDS,
  getDenaliTemplateSeedFieldDefinition,
  templateSeedRhfPath,
} from "./tour-wizard-template-builder-form";

const BUILDER_SEED_PATHS = resolveModernTemplateBuilderFieldPaths(
  listDenaliTemplateStorageFieldPaths(),
);

const HYDRATABLE_TEMPLATE = {
  category: "mountain" as const,
  duration: "single" as const,
  title: "Semantic drift probe",
  program: { shortDescription: "Short", themeIds: [] as string[] },
};

const TEMPLATE_SHELL = {
  id: "tpl-semantic-drift",
  workspaceId: "ws-semantic-drift",
  fieldRulesOverlay: {},
  baseProfile: "denali" as const,
};

test("builder seed paths map to registry rhf paths (no phantom eventVariant)", () => {
  assert.equal(BUILDER_SEED_PATHS.includes("eventVariant"), false);
  for (const storagePath of BUILDER_SEED_PATHS) {
    const definition = getDenaliTemplateSeedFieldDefinition(storagePath);
    assert.ok(definition, `missing registry definition for ${storagePath}`);
    if (DENALI_TEMPLATE_SEED_COMPOSITE_ZOD_KINDS.has(definition.zodKind)) {
      continue;
    }
    assert.equal(templateSeedRhfPath(storagePath), definition.rhfPath);
  }
});

test("orchestrateDenaliWizardFromTemplate matches factory on hydratable canonical", async () => {
  const canonicalData = { ...HYDRATABLE_TEMPLATE };

  const factoryResult = await denaliTemplateOrchestratorFactory.createDraftFromTemplate({
    workspaceId: TEMPLATE_SHELL.workspaceId,
    templateId: TEMPLATE_SHELL.id,
    canonicalData,
    fieldRulesOverlay: {},
  });
  assert.equal(factoryResult.success, true);

  const clientResult = await orchestrateDenaliWizardFromTemplate(
    { ...TEMPLATE_SHELL, canonicalData } as never,
    canonicalData,
  );
  assert.equal(clientResult.success, true);

  const factoryForm = factoryResult.draftState.data.form as { basicInfo?: { title?: string } };
  assert.equal(
    clientResult.success && clientResult.form.basicInfo?.title,
    factoryForm.basicInfo?.title,
  );
});

test("empty canonical hydrates via orchestrate and factory with registry defaults", async () => {
  const canonicalData = {};

  const factoryResult = await denaliTemplateOrchestratorFactory.createDraftFromTemplate({
    workspaceId: TEMPLATE_SHELL.workspaceId,
    templateId: TEMPLATE_SHELL.id,
    canonicalData,
    fieldRulesOverlay: {},
  });
  assert.equal(factoryResult.success, true);

  const clientResult = await orchestrateDenaliWizardFromTemplate(
    { ...TEMPLATE_SHELL, canonicalData } as never,
    canonicalData,
  );
  assert.equal(clientResult.success, true);
});

test("denaliCanonicalFromForm preserves duration for classified wizard save", () => {
  const defaults = buildDenaliTourCreateDefaultValues();
  const form = denaliCanonicalToForm(
    {
      ...HYDRATABLE_TEMPLATE,
      destinationId: defaults.basicInfo.destinationId,
      startDateTime: defaults.basicInfo.startDateTime,
      transport: { mode: "none" },
      pricing: { paymentMode: "offline_receipt" },
      participants: {},
      policies: { policiesText: "" },
    },
    defaults,
    {
      basics: { category: "mountain", duration: "single_day", eventVariant: undefined },
    },
  );

  const packed = canonicalDataFromWizardForm(form);
  assert.equal(packed.duration, HYDRATABLE_TEMPLATE.duration);
});
