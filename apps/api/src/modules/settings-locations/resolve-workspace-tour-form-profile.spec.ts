import assert from "node:assert/strict";
import test from "node:test";
import type { Repository } from "typeorm";

import { WorkspaceTourWizardTemplateEntity } from "./entities/workspace-tour-wizard-template.entity";
import { resolveWorkspaceTourFormProfile } from "./resolve-workspace-tour-form-profile";

function mockRepo(
  row: Pick<WorkspaceTourWizardTemplateEntity, "baseProfile"> | null,
): Repository<WorkspaceTourWizardTemplateEntity> {
  return {
    findOne: async () => row,
  } as unknown as Repository<WorkspaceTourWizardTemplateEntity>;
}

test("resolveWorkspaceTourFormProfile: returns template base_profile", async () => {
  const r = await resolveWorkspaceTourFormProfile(
    "ws-a",
    mockRepo({ baseProfile: "denali_pilot" }),
  );
  assert.equal(r.profile, "denali_pilot");
  assert.equal(r.source, "workspace_template");
});

test("resolveWorkspaceTourFormProfile: missing row → general", async () => {
  const r = await resolveWorkspaceTourFormProfile("ws-b", mockRepo(null));
  assert.equal(r.profile, "general");
  assert.equal(r.source, "workspace_template_missing");
});

test("resolveWorkspaceTourFormProfile: normalizes invalid profile", async () => {
  const r = await resolveWorkspaceTourFormProfile(
    "ws-c",
    mockRepo({ baseProfile: "not_a_real_profile" as "denali_pilot" }),
  );
  assert.equal(r.profile, "general");
});
