import assert from "node:assert/strict";
import test from "node:test";
import type { Repository } from "typeorm";

import { WorkspaceTourWizardTemplateEntity } from "./entities/workspace-tour-wizard-template.entity";
import { WorkspaceTourCreationPresetEntity } from "./entities/workspace-tour-creation-preset.entity";
import { resolveWorkspaceTourFormProfile } from "./repositories/resolve-workspace-tour-form-profile";

function mockTemplateRepo(
  row: Pick<WorkspaceTourWizardTemplateEntity, "baseProfile"> | null,
): Repository<WorkspaceTourWizardTemplateEntity> {
  return {
    findOne: async () => row,
  } as unknown as Repository<WorkspaceTourWizardTemplateEntity>;
}

function mockPresetRepo(
  row: Pick<WorkspaceTourCreationPresetEntity, "formProfile"> | null,
): Repository<WorkspaceTourCreationPresetEntity> {
  return {
    findOne: async () => row,
  } as unknown as Repository<WorkspaceTourCreationPresetEntity>;
}

test("resolveWorkspaceTourFormProfile: returns template base_profile", async () => {
  const r = await resolveWorkspaceTourFormProfile(
    "ws-a",
    mockTemplateRepo({ baseProfile: "denali_pilot" }),
    mockPresetRepo(null),
  );
  assert.equal(r.profile, "denali_pilot");
  assert.equal(r.source, "workspace_template");
});

test("resolveWorkspaceTourFormProfile: returns preset profile when presetId provided", async () => {
  const r = await resolveWorkspaceTourFormProfile(
    "ws-a",
    mockTemplateRepo({ baseProfile: "general" }),
    mockPresetRepo({ formProfile: "mountain_outdoor" }),
    "preset-1",
  );
  assert.equal(r.profile, "mountain_outdoor");
  assert.equal(r.source, "selected_preset");
});

test("resolveWorkspaceTourFormProfile: missing row → general", async () => {
  const r = await resolveWorkspaceTourFormProfile(
    "ws-b",
    mockTemplateRepo(null),
    mockPresetRepo(null),
  );
  assert.equal(r.profile, "general");
  assert.equal(r.source, "workspace_template_missing");
});

test("resolveWorkspaceTourFormProfile: normalizes invalid profile", async () => {
  const r = await resolveWorkspaceTourFormProfile(
    "ws-c",
    mockTemplateRepo({ baseProfile: "not_a_real_profile" as "denali_pilot" }),
    mockPresetRepo(null),
  );
  assert.equal(r.profile, "general");
});
