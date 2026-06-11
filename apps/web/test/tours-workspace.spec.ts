/**
 * Phase 9.3 — tour workspace shell (R3)
 * Authority: docs/phase-9/appendices/TOURS-WORKSPACE-UX.md
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TOUR_EDIT_TEST_IDS } from "../src/features/tours/operator-tour-detail-types";
import { TOURS_LIST_TEST_IDS } from "../src/features/tours/query-model";
import {
  hrefForWorkspaceTab,
  resolveWorkspaceSubnavTab,
  workspaceBasePath,
} from "../src/features/tours/tour-workspace-logic";
import { TOUR_WORKSPACE_TEST_IDS } from "../src/features/tours/tour-workspace-types";
import {
  buildTourWaitlistBookingsQuery,
  buildTourWaitlistCommandCenterHref,
  sortWaitlistRows,
  TOUR_WORKSPACE_WAITLIST_TEST_IDS,
} from "../src/features/tours/tour-workspace-waitlist-logic";
import {
  buildTourTransportBookingsQuery,
  buildTourTransportCommandCenterHref,
  extractTransportModesFromTourPayload,
  formatTransportModeLabel,
  sortTransportRosterRows,
  TOUR_WORKSPACE_TRANSPORT_TEST_IDS,
} from "../src/features/tours/tour-workspace-transport-logic";
import {
  buildTourRegistrationsBookingsQuery,
  buildTourRegistrationsCommandCenterHref,
  sortRegistrationRows,
  TOUR_WORKSPACE_REGISTRATIONS_TEST_IDS,
} from "../src/features/tours/tour-workspace-registrations-logic";

const TOUR_ID = "00000000-0000-4000-8000-000000000099";

describe("tours-workspace.spec.ts — Phase 9.3 Web", () => {
  it("WEB-9.3-W01 workspace exposes page landmarks (CP-9.3-W01)", () => {
    assert.equal(TOUR_WORKSPACE_TEST_IDS.page, "operator-tour-workspace-page");
    assert.equal(TOUR_WORKSPACE_TEST_IDS.subnav, "operator-tour-workspace-subnav");
    assert.equal(
      TOUR_WORKSPACE_TEST_IDS.registrationsPanel,
      "operator-tour-workspace-registrations-panel"
    );
  });

  it("WEB-9.3-W02 subnav resolver highlights active tab (CP-9.3-W02)", () => {
    const base = workspaceBasePath(TOUR_ID);
    assert.equal(resolveWorkspaceSubnavTab(base, TOUR_ID), "registrations");
    assert.equal(resolveWorkspaceSubnavTab(`${base}/waitlist`, TOUR_ID), "waitlist");
    assert.equal(resolveWorkspaceSubnavTab(`${base}/transport`, TOUR_ID), "transport");
    assert.equal(hrefForWorkspaceTab(TOUR_ID, "waitlist"), `${base}/waitlist`);
  });

  it("WEB-9.3-W03 list and edit link ids for workspace (CP-9.3-W03)", () => {
    assert.equal(TOURS_LIST_TEST_IDS.workspace, "operator-tours-workspace");
    assert.equal(TOUR_EDIT_TEST_IDS.workspace, "operator-tour-edit-workspace");
    assert.equal(workspaceBasePath(TOUR_ID), `/tours/${TOUR_ID}/workspace`);
  });

  it("WEB-9.3-W04 waitlist query scopes bookings API to tour + waitlisted (CP-9.3-W05)", () => {
    const query = buildTourWaitlistBookingsQuery(TOUR_ID);
    const params = new URLSearchParams(query);
    assert.equal(params.get("status"), "waitlisted");
    assert.equal(params.get("tourId"), TOUR_ID);
    assert.equal(params.get("view"), "ops");
    assert.equal(
      buildTourWaitlistCommandCenterHref(TOUR_ID),
      `/bookings?${query}`
    );
    assert.equal(TOUR_WORKSPACE_WAITLIST_TEST_IDS.table, "operator-tour-workspace-waitlist-table");
    assert.equal(TOUR_WORKSPACE_WAITLIST_TEST_IDS.empty, "operator-tour-workspace-waitlist-empty");
  });

  it("WEB-9.3-W05 waitlist rows sort by submittedAt ascending", () => {
    const sorted = sortWaitlistRows([
      {
        id: "b-2",
        tourId: TOUR_ID,
        tourTitle: "Trek",
        guestLabel: "Later",
        partySize: 1,
        status: "waitlisted",
        paymentStatus: "unpaid",
        departureAt: "2026-07-01T00:00:00.000Z",
        submittedAt: "2026-06-02T00:00:00.000Z",
      },
      {
        id: "b-1",
        tourId: TOUR_ID,
        tourTitle: "Trek",
        guestLabel: "First",
        partySize: 2,
        status: "waitlisted",
        paymentStatus: "unpaid",
        departureAt: "2026-07-01T00:00:00.000Z",
        submittedAt: "2026-06-01T00:00:00.000Z",
      },
    ]);
    assert.equal(sorted[0]?.id, "b-1");
    assert.equal(sorted[1]?.id, "b-2");
  });

  it("WEB-9.3-W06 transport query scopes approved bookings + canonical modes (CP-9.3-W06)", () => {
    const query = buildTourTransportBookingsQuery(TOUR_ID);
    const params = new URLSearchParams(query);
    assert.equal(params.get("status"), "approved");
    assert.equal(params.get("tourId"), TOUR_ID);
    assert.equal(params.get("view"), "ops");
    assert.equal(
      buildTourTransportCommandCenterHref(TOUR_ID),
      `/bookings?${query}`
    );
    assert.equal(TOUR_WORKSPACE_TRANSPORT_TEST_IDS.table, "operator-tour-workspace-transport-table");
    assert.equal(TOUR_WORKSPACE_TRANSPORT_TEST_IDS.empty, "operator-tour-workspace-transport-empty");

    const modes = extractTransportModesFromTourPayload({
      canonical: {
        data: {
          details: {
            tripDetails: {
              transportModes: ["van", "private_car"],
            },
          },
        },
      },
    });
    assert.deepEqual(modes, ["private_car", "van"]);
    assert.equal(formatTransportModeLabel("shuttle_bus"), "Shuttle Bus");
  });

  it("WEB-9.3-W07 transport roster sorts by guest then departure", () => {
    const sorted = sortTransportRosterRows([
      {
        id: "b-2",
        tourId: TOUR_ID,
        tourTitle: "Trek",
        guestLabel: "Zara",
        partySize: 1,
        status: "approved",
        paymentStatus: "unpaid",
        departureAt: "2026-07-01T00:00:00.000Z",
        submittedAt: "2026-06-02T00:00:00.000Z",
      },
      {
        id: "b-1",
        tourId: TOUR_ID,
        tourTitle: "Trek",
        guestLabel: "Ali",
        partySize: 2,
        status: "approved",
        paymentStatus: "paid",
        departureAt: "2026-07-02T00:00:00.000Z",
        submittedAt: "2026-06-01T00:00:00.000Z",
      },
    ]);
    assert.equal(sorted[0]?.id, "b-1");
    assert.equal(sorted[1]?.id, "b-2");
  });

  it("WEB-9.3-R04 registrations query scopes pending bookings to tour (CP-9.3-R04)", () => {
    const query = buildTourRegistrationsBookingsQuery(TOUR_ID);
    const params = new URLSearchParams(query);
    assert.equal(params.get("status"), "pending");
    assert.equal(params.get("tourId"), TOUR_ID);
    assert.equal(
      buildTourRegistrationsCommandCenterHref(TOUR_ID),
      `/bookings?${query}`
    );
    assert.equal(
      TOUR_WORKSPACE_REGISTRATIONS_TEST_IDS.table,
      "operator-tour-workspace-registrations-table"
    );
    const sorted = sortRegistrationRows([
      {
        id: "b-2",
        tourId: TOUR_ID,
        tourTitle: "Trek",
        guestLabel: "Later",
        partySize: 1,
        status: "pending",
        paymentStatus: "unpaid",
        departureAt: "2026-07-01T00:00:00.000Z",
        submittedAt: "2026-06-02T00:00:00.000Z",
      },
      {
        id: "b-1",
        tourId: TOUR_ID,
        tourTitle: "Trek",
        guestLabel: "First",
        partySize: 2,
        status: "pending",
        paymentStatus: "unpaid",
        departureAt: "2026-07-01T00:00:00.000Z",
        submittedAt: "2026-06-01T00:00:00.000Z",
      },
    ]);
    assert.equal(sorted[0]?.id, "b-1");
  });
});
