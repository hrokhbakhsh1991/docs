/**
 * P15-P-B4 — manifest-driven tour PATCH publish-owner dispatch
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DENALI_TOUR_PUBLISH_FIELDS_OWNER_SURFACE } from "@app-tour/workspace-denali/host/tours";
import { URBAN_TOUR_PUBLISH_FIELDS_OWNER_SURFACE } from "@app-tour/workspace-urban/tours";

import {
  assertTourPublishFieldOwner,
  mergeCanonicalPatchDataForWorkspace,
  operatorMemberTourPatchForbidden,
  tourPublishFieldOwnerSurface,
} from "../src/tours/workspace-tour-write-dispatch";

describe("workspace-tour-write-dispatch.spec.ts — P15-P-B4", () => {
  it("API-P15-B4-01 exposes publish owner surfaces from manifest bindings", () => {
    assert.equal(tourPublishFieldOwnerSurface("denali"), DENALI_TOUR_PUBLISH_FIELDS_OWNER_SURFACE);
    assert.equal(tourPublishFieldOwnerSurface("urban"), URBAN_TOUR_PUBLISH_FIELDS_OWNER_SURFACE);
  });

  it("API-P15-B4-02 operatorMemberTourPatchForbidden is denali-only", () => {
    assert.equal(operatorMemberTourPatchForbidden("denali"), true);
    assert.equal(operatorMemberTourPatchForbidden("urban"), false);
    assert.equal(operatorMemberTourPatchForbidden("starter"), false);
  });

  it("API-P15-B4-03 assertTourPublishFieldOwner rejects urban member on publish surface", () => {
    const auth = {
      userId: "00000000-0000-4000-8000-000000000402",
      tenantId: "00000000-0000-4000-8000-000000000004",
      role: "member" as const,
      status: "ACTIVE" as const,
      workspaceId: "ws-urban-member",
    };
    assert.throws(
      () =>
        assertTourPublishFieldOwner({
          auth,
          workspaceType: "urban",
          surface: URBAN_TOUR_PUBLISH_FIELDS_OWNER_SURFACE,
        }),
      (error: unknown) => {
        assert.match(String(error), /URBAN_OWNER_REQUIRED/);
        return true;
      }
    );
  });

  it("API-P15-B4-04 assertTourPublishFieldOwner allows denali owner on publish surface", () => {
    const auth = {
      userId: "00000000-0000-4000-8000-000000000101",
      tenantId: "00000000-0000-4000-8000-000000000003",
      role: "owner" as const,
      status: "ACTIVE" as const,
      workspaceId: "ws-denali-owner",
    };
    assert.doesNotThrow(() =>
      assertTourPublishFieldOwner({
        auth,
        workspaceType: "denali",
        surface: DENALI_TOUR_PUBLISH_FIELDS_OWNER_SURFACE,
      })
    );
  });

  it("API-P15-B4-05 starter default merge preserves sibling roots on fragment PATCH", () => {
    const existing = {
      basics: { title: "Seed" },
      details: { summary: "ok" },
      pricing: { paymentMode: "gateway" },
    };
    const merged = mergeCanonicalPatchDataForWorkspace("starter", existing, {
      basics: { title: "Updated" },
    });
    assert.equal((merged.basics as { title: string }).title, "Updated");
    assert.deepEqual(merged.details, { summary: "ok" });
    assert.deepEqual(merged.pricing, { paymentMode: "gateway" });
  });
});
