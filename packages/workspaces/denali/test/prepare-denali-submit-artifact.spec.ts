/**
 * Phase 11.10 — prepareDenaliSubmitArtifact retains composite arrays
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCanonicalDocument } from "@app-tour/workspace-sdk";

import {
  DENALI_CURRENT_CANONICAL_SCHEMA_VERSION,
  prepareDenaliSubmitArtifact,
} from "../src/acl/migrateDenaliCanonical";
import { buildDenaliWizardRoots } from "../src/denali-plugin-adapter";
import { buildDenaliTourCreateDefaultValues } from "../src/schemas/denaliCore.schema";

describe("prepare-denali-submit-artifact.spec.ts — Phase 11.10", () => {
  it("DENALI-P11-10-01 retains gearItems and themeIds in canonical ingress", () => {
    const form = buildDenaliTourCreateDefaultValues() as Record<string, unknown>;
    form.participantRequirements = {
      ...(form.participantRequirements as Record<string, unknown>),
      gearItems: [{ equipmentId: "eq-1", name: "Poles", isRequired: true }],
    };
    form.programNature = {
      ...(form.programNature as Record<string, unknown>),
      themeIds: ["theme-1"],
    };
    form.basicInfo = {
      ...(form.basicInfo as Record<string, unknown>),
      leaderUserIds: ["leader-1"],
    };

    const data = prepareDenaliSubmitArtifact(form);
    const participants = data.participants as Record<string, unknown>;
    const program = data.program as Record<string, unknown>;
    assert.ok(Array.isArray(participants.gearItems));
    assert.deepEqual(program.themeIds, ["theme-1"]);
    assert.deepEqual(data.leaderUserIds, ["leader-1"]);
  });

  it("DENALI-P11-10-02 passes createCanonicalDocument with projected arrays", () => {
    const form = buildDenaliTourCreateDefaultValues() as Record<string, unknown>;
    form.participantRequirements = {
      ...(form.participantRequirements as Record<string, unknown>),
      gearItems: [{ equipmentId: "eq-1", name: "Poles", isRequired: true }],
    };
    const data = prepareDenaliSubmitArtifact(form);
    const doc = createCanonicalDocument({
      schemaVersion: DENALI_CURRENT_CANONICAL_SCHEMA_VERSION,
      roots: [...buildDenaliWizardRoots()],
      data: data as Record<string, unknown>,
    });
    const participants = doc.data.participants as Record<string, unknown>;
    assert.equal((participants.gearItems as unknown[]).length, 1);
  });
});
