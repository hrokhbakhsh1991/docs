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

  it("DEN-CAMP-PERSIST-01 copies campPoint onto tripDetails.overview and keeps trailDistanceKm", () => {
    const form = buildDenaliTourCreateDefaultValues() as Record<string, unknown>;
    const campPoint = {
      label: "کمپ آبشار اسکلیم",
      address: "آبشار آهکی اسکلیم, لفور",
      latitude: 36.16399,
      longitude: 52.76416,
    };
    form.basicInfo = {
      ...(form.basicInfo as Record<string, unknown>),
      campPoint,
    };
    form.tripDetails = {
      ...(form.tripDetails as Record<string, unknown>),
      overview: {
        trailDistanceKm: 8,
        customServiceLabels: [],
      },
    };

    const data = prepareDenaliSubmitArtifact(form);
    const overview = (data.tripDetails as Record<string, unknown>).overview as Record<
      string,
      unknown
    >;
    assert.deepEqual(overview.campPoint, campPoint);
    assert.equal(overview.trailDistanceKm, 8);
    assert.deepEqual(data.campPoint, campPoint);
    assert.equal("osmName" in (overview.campPoint as object), false);
  });

  it("DEN-CAMP-PERSIST-01 copies summit and end ghosts onto overview", () => {
    const form = buildDenaliTourCreateDefaultValues() as Record<string, unknown>;
    const summitPoint = { label: "نقطه اوج مسیر" };
    const endPoint = { address: "ترمینال شرق", latitude: 35.72, longitude: 51.52 };
    form.basicInfo = {
      ...(form.basicInfo as Record<string, unknown>),
      summitPoint,
      endPoint,
    };

    const data = prepareDenaliSubmitArtifact(form);
    const overview = (data.tripDetails as Record<string, unknown> | undefined)?.overview as
      | Record<string, unknown>
      | undefined;
    assert.deepEqual(overview?.summitPoint, summitPoint);
    assert.deepEqual(overview?.endPoint, endPoint);
  });
});
