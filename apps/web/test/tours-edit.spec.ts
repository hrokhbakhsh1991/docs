/**
 * Phase 9.3 — tour edit UI
 * Authority: docs/phase-9/appendices/TOURS-EDIT-UX.md
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  buildTourTitlePatch,
  canMutateTour,
} from "../src/features/tours/build-tour-title-patch";
import { isDenaliOperatorSession } from "../src/admin/require-operator-session";
import { TOUR_EDIT_TEST_IDS } from "../src/features/tours/operator-tour-detail-types";
import type { OperatorTourDetailResponse } from "../src/features/tours/operator-tour-detail-types";

function sampleDetail(): OperatorTourDetailResponse {
  return {
    id: "00000000-0000-4000-8000-000000000099",
    tenantId: "00000000-0000-4000-8000-000000000014",
    rowVersion: 2,
    canonical: {
      data: {
        basics: { title: "Old title", summary: "Summary" },
      },
    },
    projection: {
      id: "00000000-0000-4000-8000-000000000099",
      tenantId: "00000000-0000-4000-8000-000000000014",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      rowVersion: 2,
      title: "Old title",
      shortDescription: "Summary",
      listStatus: "draft",
      uiStatus: "draft",
      priceAmount: null,
      priceCurrency: null,
      totalCapacity: null,
      acceptedCount: 0,
      category: null,
      coverImageUrl: null,
      departureAt: null,
    },
  };
}

describe("tours-edit.spec.ts — Phase 9.3 Web", () => {
  it("WEB-9.3-E01 tour edit exposes page landmarks (CP-9.3-E03)", () => {
    assert.equal(TOUR_EDIT_TEST_IDS.page, "operator-tour-edit-page");
    assert.equal(TOUR_EDIT_TEST_IDS.title, "operator-tour-edit-title");
    assert.equal(TOUR_EDIT_TEST_IDS.save, "operator-tour-edit-save");
    assert.equal(TOUR_EDIT_TEST_IDS.publish, "operator-tour-edit-publish");
    assert.equal(TOUR_EDIT_TEST_IDS.unpublish, "operator-tour-edit-unpublish");
    assert.equal(TOUR_EDIT_TEST_IDS.cancel, "operator-tour-edit-cancel");
    assert.equal(TOUR_EDIT_TEST_IDS.draftSync, "operator-tour-edit-draft-sync");
    assert.equal(TOUR_EDIT_TEST_IDS.flatForm, "operator-tour-edit-flat-form");
    assert.equal(
      TOUR_EDIT_TEST_IDS.flatSection("denali_basic"),
      "operator-tour-edit-section-denali_basic"
    );
  });

  it("WEB-9.3-E02 buildTourTitlePatch uses canonical basics shape", () => {
    const patch = buildTourTitlePatch(sampleDetail(), "New title");
    assert.equal(patch.rowVersion, 2);
    assert.deepEqual(patch.roots, ["basics"]);
    const basics = patch.data.basics as { title: string };
    assert.equal(basics.title, "New title");
  });

  it("WEB-9.3-E04 member cannot mutate tours (CP-9.3-E04)", () => {
    assert.equal(canMutateTour("member"), false);
    assert.equal(canMutateTour("admin"), true);
    assert.equal(canMutateTour("owner"), true);
  });

  it("WEB-9.3-E05 denali operator session routes to flat edit shell", () => {
    assert.equal(
      isDenaliOperatorSession({
        userId: "u1",
        tenantId: "00000000-0000-4000-8000-000000000014",
        role: "owner",
        workspaceType: "denali",
        pluginId: "denali",
      }),
      true
    );
    assert.equal(
      isDenaliOperatorSession({
        userId: "u1",
        tenantId: "t1",
        role: "owner",
        workspaceType: "starter",
        pluginId: "starter",
      }),
      false
    );
  });

  it("WEB-DENALI-FLAT-EDIT-01 flat edit page applies wizard skin scope root", () => {
    const flatEdit = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../src/wizard/denali-flat-edit-chrome.tsx"),
      "utf8"
    );
    const pageClient = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../app/(app)/tours/[id]/edit/denali-flat-edit-page-client.tsx"
      ),
      "utf8"
    );
    assert.match(flatEdit, /data-new-tour-wizard/);
    assert.match(flatEdit, /data-denali-flat-edit-page/);
    assert.match(flatEdit, /new-tour-wizard-page__header/);
    assert.match(pageClient, /DenaliFlatEditPageShell/);
    assert.match(pageClient, /DenaliFlatEditPageHeader/);
  });
});
