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
import { isExtendedOperatorSession } from "../src/admin/require-operator-session";
import { seedWizardCreate } from "../src/workspace/wizard-create-registry";
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
    assert.equal(TOUR_EDIT_TEST_IDS.saveSecondary, "operator-tour-edit-save-secondary");
    assert.equal(TOUR_EDIT_TEST_IDS.stickyActions, "operator-tour-edit-sticky-actions");
    assert.equal(TOUR_EDIT_TEST_IDS.lifecycleMenu, "operator-tour-edit-lifecycle-menu");
    assert.equal(TOUR_EDIT_TEST_IDS.draftManualSave, "operator-tour-edit-draft-manual-save");
    assert.equal(TOUR_EDIT_TEST_IDS.warmError, "operator-tour-edit-warm-error");
    assert.equal(TOUR_EDIT_TEST_IDS.warmRetry, "operator-tour-edit-warm-retry");
    assert.equal(TOUR_EDIT_TEST_IDS.warmBack, "operator-tour-edit-warm-back");
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

  it("WEB-9.3-E04 member and viewer cannot mutate tours (CP-9.3-E04)", () => {
    assert.equal(canMutateTour("member"), false);
    assert.equal(canMutateTour("viewer"), false);
    assert.equal(canMutateTour("admin"), true);
    assert.equal(canMutateTour("owner"), true);
  });

  it("WEB-9.3-E05 extended operator session routes to flat edit shell", () => {
    seedWizardCreate("denali", { extendedChrome: true });
    seedWizardCreate("starter", { extendedChrome: false });
    assert.equal(
      isExtendedOperatorSession({
        userId: "u1",
        tenantId: "00000000-0000-4000-8000-000000000014",
        role: "owner",
        workspaceType: "denali",
        pluginId: "denali",
      }),
      true
    );
    assert.equal(
      isExtendedOperatorSession({
        userId: "u1",
        tenantId: "t1",
        role: "owner",
        workspaceType: "starter",
        pluginId: "starter",
      }),
      false
    );
  });

  it("WEB-C4-01 tour edit router uses extended operator session gate", () => {
    const pageClient = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../app/(app)/tours/[id]/edit/tour-edit-page-client.tsx"
      ),
      "utf8"
    );
    assert.match(pageClient, /isExtendedOperatorSession/);
    assert.doesNotMatch(pageClient, /isDenaliOperatorSession/);
    assert.doesNotMatch(pageClient, /\bisDenali\b/);
  });

  it("WEB-DENALI-FLAT-EDIT-01 flat edit page applies wizard skin scope root", () => {
    const flatEdit = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../src/wizard/flat-edit-chrome.tsx"),
      "utf8"
    );
    const pageClient = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../app/(app)/tours/[id]/edit/flat-edit-page-client.tsx"
      ),
      "utf8"
    );
    assert.match(flatEdit, /data-new-tour-wizard/);
    assert.match(flatEdit, /data-operator-flat-edit-page/);
    assert.match(flatEdit, /new-tour-wizard-page__header/);
    assert.match(pageClient, /OperatorFlatEditPageShell/);
    assert.match(pageClient, /OperatorFlatEditPageHeader/);
  });

  it("WEB-DENALI-FLAT-EDIT-02 flat edit keeps one canonical primary save action", () => {
    const flatEdit = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../app/(app)/tours/[id]/edit/flat-edit-page-client.tsx"
      ),
      "utf8"
    );
    const stickyActions = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../src/wizard/flat-edit-sticky-actions.tsx"),
      "utf8"
    );
    const chrome = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../src/wizard/flat-edit-chrome.tsx"),
      "utf8"
    );
    const skin = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../../../packages/workspaces/denali/theme/wizard-skin.css"
      ),
      "utf8"
    );
    assert.match(flatEdit, /OperatorFlatEditStickyActionBar/);
    assert.match(flatEdit, /const handleSave = \(\) => void readyCore\.handlePatch\("save"\)/);
    assert.match(stickyActions, /data-testid=\{TOUR_EDIT_TEST_IDS\.save\}/);
    assert.match(stickyActions, /data-testid=\{TOUR_EDIT_TEST_IDS\.lifecycleMenu\}/);
    assert.match(stickyActions, /DropdownMenuItem/);
    assert.doesNotMatch(flatEdit, /saveSecondary/);
    assert.doesNotMatch(chrome, /primaryAction/);
    assert.match(chrome, /TOUR_EDIT_TEST_IDS\.draftManualSave/);
    assert.match(skin, /\.new-tour-wizard-page__sticky-actions/);
    assert.match(skin, /position: fixed/);
    assert.match(skin, /safe-area-inset-bottom/);
    assert.match(skin, /@media \(max-width: 1023px\)/);
  });

  it("WEB-DENALI-FLAT-EDIT-04 lifecycle actions stay secondary behind more menu", () => {
    const stickyActions = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../src/wizard/flat-edit-sticky-actions.tsx"),
      "utf8"
    );
    assert.match(stickyActions, /TOUR_EDIT_TEST_IDS\.publish/);
    assert.match(stickyActions, /TOUR_EDIT_TEST_IDS\.unpublish/);
    assert.doesNotMatch(stickyActions, /variant="default"[\s\S]*publish/);
  });

  it("WEB-DENALI-FLAT-EDIT-03 warm failure is recoverable and user-triggered", () => {
    const flatEdit = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../app/(app)/tours/[id]/edit/flat-edit-page-client.tsx"
      ),
      "utf8"
    );
    const faMessages = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../messages/fa/tours.json"),
      "utf8"
    );
    const enMessages = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../messages/en/tours.json"),
      "utf8"
    );

    assert.match(flatEdit, /warmFlatEditOperatorShell\(session\.pluginId\)/);
    assert.match(flatEdit, /\.then\(\(loaded\) =>/);
    assert.match(flatEdit, /\.catch\(\(\) =>/);
    assert.match(flatEdit, /setWarmFailed\(true\)/);
    assert.match(flatEdit, /OperatorFlatEditWarmError/);
    assert.match(flatEdit, /data-testid=\{TOUR_EDIT_TEST_IDS\.warmError\}/);
    assert.match(flatEdit, /data-testid=\{TOUR_EDIT_TEST_IDS\.warmRetry\}/);
    assert.match(flatEdit, /data-testid=\{TOUR_EDIT_TEST_IDS\.warmBack\}/);
    assert.match(flatEdit, /onClick=\{onRetry\}/);
    assert.match(flatEdit, /warmInFlightRef\.current/);
    assert.match(flatEdit, /if \(warmInFlightRef\.current\) \{/);
    assert.match(flatEdit, /setWarmLoading\(true\)/);
    assert.match(flatEdit, /setWarmFailed\(false\)/);
    assert.doesNotMatch(flatEdit, /cause instanceof Error/);
    assert.doesNotMatch(flatEdit, /message: warm/);
    assert.match(faMessages, /"warmErrorTitle": "ویرایش تور آماده نشد"/);
    assert.match(faMessages, /"warmErrorBody": "بارگذاری اطلاعات ویرایش با مشکل روبه‌رو شد\."/);
    assert.match(enMessages, /"warmErrorTitle": "Edit tour is not ready"/);
  });
});
