import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  OPERATOR_SMOKE_PARTICIPANT_TOUR_ID,
  OPERATOR_SMOKE_PARTICIPANT_TOUR_TITLE,
  OPERATOR_SMOKE_PUBLISHED_TOUR_CATALOG,
  OPERATOR_SMOKE_PUBLISHED_TOUR_TITLE,
  OPERATOR_SMOKE_SEED_TOUR_ID,
  OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_ID,
  OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_TITLE,
  OPERATOR_SMOKE_TRANSPORT_SHARED_TOUR_ID,
  OPERATOR_SMOKE_TRANSPORT_SHARED_TOUR_TITLE,
  DENALI_STAGING_FINAL_APPROVAL_TOUR_ID,
  DENALI_STAGING_FINAL_APPROVAL_TOUR_MARKER,
  DENALI_STAGING_FINAL_APPROVAL_TOUR_TITLE,
  applyOperatorSmokePublishedTourEditReadyPatch,
  buildDenaliStagingFinalApprovalTour,
  buildOperatorSmokeParticipantRequirementsTourCanonical,
  buildOperatorSmokePublishedTourCanonical,
  buildOperatorSmokeTransportBusTourCanonical,
  buildOperatorSmokeTransportSharedCarsTourCanonical,
  isOperatorSmokePublishedTourEditReady,
  isOwnedDenaliStagingFinalApprovalTour,
  resolveOperatorSmokePublishedTourWindow,
} from "../src/fixtures/operator-smoke-published-tour.fixture";
import { seedDenaliStagingFinalApprovalTour } from "../src/settings/seed-operator-smoke-published-tour";

describe("operator-smoke-published-tour.fixture.ts", () => {
  it("API-SMOKE-TPL-01 published tour canonical includes 3-day itinerary (ED-SEED-01)", () => {
    const canonical = buildOperatorSmokePublishedTourCanonical();
    assert.equal(canonical.data.title, OPERATOR_SMOKE_PUBLISHED_TOUR_TITLE);
    assert.deepEqual(canonical.roots, Object.keys(canonical.data as Record<string, unknown>));
    const program = canonical.data.program as {
      itinerary?: Array<{ title?: string; segments?: Array<{ title?: string }> }>;
    };
    assert.equal(program.itinerary?.length, 3);
    assert.equal(program.itinerary?.[0]?.title, "Summit push");
    assert.equal(program.itinerary?.[0]?.segments?.[0]?.title, "Ridge ascent");
    assert.equal(program.itinerary?.[2]?.title, "Departure buffer");
    assert.equal(OPERATOR_SMOKE_SEED_TOUR_ID, "00000000-0000-4000-8000-000000000210");
    assert.equal(
      isOperatorSmokePublishedTourEditReady(
        canonical.data as Record<string, unknown>,
        OPERATOR_SMOKE_PUBLISHED_TOUR_CATALOG
      ),
      true
    );
  });

  it("PAY-SEED-01 — published tour window stays in the future relative to now", () => {
    const now = new Date("2026-08-16T12:00:00.000Z");
    const window = resolveOperatorSmokePublishedTourWindow(now);
    assert.equal(window.startDateTime, "2026-08-30T08:00:00.000Z");
    assert.equal(window.endDateTime, "2026-09-01T18:00:00.000Z");
    assert.ok(new Date(window.startDateTime).getTime() > now.getTime());
    const canonical = buildOperatorSmokePublishedTourCanonical();
    const start = new Date(String(canonical.data.startDateTime));
    assert.ok(start.getTime() > Date.now());
  });

  it("API-SMOKE-TPL-01b edit-ready patch fills empty scaffolded day titles", () => {
    const incomplete: Record<string, unknown> = {
      title: OPERATOR_SMOKE_PUBLISHED_TOUR_TITLE,
      startDateTime: "2026-07-01T08:00:00.000Z",
      endDateTime: "2026-07-03T18:00:00.000Z",
      category: "mountain_multi",
      program: {
        itinerary: [
          { dayNumber: 1, title: "Summit push", segments: [{ id: "s1", kind: "activity", title: "A" }] },
          { dayNumber: 2, title: "Return leg", segments: [{ id: "s2", kind: "transport", title: "B" }] },
        ],
      },
    };
    assert.equal(
      isOperatorSmokePublishedTourEditReady(incomplete, OPERATOR_SMOKE_PUBLISHED_TOUR_CATALOG),
      false
    );
    const patched = applyOperatorSmokePublishedTourEditReadyPatch(
      incomplete,
      OPERATOR_SMOKE_PUBLISHED_TOUR_CATALOG
    );
    assert.equal(
      isOperatorSmokePublishedTourEditReady(patched, OPERATOR_SMOKE_PUBLISHED_TOUR_CATALOG),
      true
    );
  });

  it("API-SMOKE-TPL-02 participant tour canonical sets participantRequirements flags", () => {
    const canonical = buildOperatorSmokeParticipantRequirementsTourCanonical();
    const requirements = canonical.data.participantRequirements as {
      nationalIdRequired?: boolean;
      fatherNameRequired?: boolean;
      birthDateRequired?: boolean;
    };
    assert.equal(canonical.data.title, OPERATOR_SMOKE_PARTICIPANT_TOUR_TITLE);
    assert.equal(requirements.nationalIdRequired, true);
    assert.equal(requirements.fatherNameRequired, true);
    assert.equal(requirements.birthDateRequired, true);
    assert.equal(OPERATOR_SMOKE_PARTICIPANT_TOUR_ID, "00000000-0000-4000-8000-000000000212");
  });

  it("API-SMOKE-TPL-03 bus transport tour canonical sets mode + allowPersonalCar + cost", () => {
    const canonical = buildOperatorSmokeTransportBusTourCanonical();
    const transport = canonical.data.transport as {
      mode?: string;
      allowPersonalCar?: boolean;
      transportCost?: number;
    };
    assert.equal(canonical.data.title, OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_TITLE);
    assert.equal(transport.mode, "bus");
    assert.equal(transport.allowPersonalCar, true);
    assert.equal(transport.transportCost, 150_000);
    assert.equal(OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_ID, "00000000-0000-4000-8000-000000000213");
  });

  it("API-SMOKE-TPL-04 shared_cars transport tour canonical sets mode + dongAmount", () => {
    const canonical = buildOperatorSmokeTransportSharedCarsTourCanonical();
    const transport = canonical.data.transport as {
      mode?: string;
      dongAmount?: number;
    };
    assert.equal(canonical.data.title, OPERATOR_SMOKE_TRANSPORT_SHARED_TOUR_TITLE);
    assert.equal(transport.mode, "shared_cars");
    assert.equal(transport.dongAmount, 80_000);
    assert.equal(OPERATOR_SMOKE_TRANSPORT_SHARED_TOUR_ID, "00000000-0000-4000-8000-000000000214");
  });

  it("DENALI-STAGING-FINAL-APPROVAL-01 builds an owned paid/manual airplane tour", () => {
    const tenantId = "00000000-0000-4000-8000-000000000003";
    const tour = buildDenaliStagingFinalApprovalTour({ tenantId });
    const data = tour.canonical.data as Record<string, unknown>;
    const transport = data.transport as Record<string, unknown>;
    const pricing = data.pricing as Record<string, unknown>;
    const details = data.details as Record<string, unknown>;

    assert.equal(tour.id, DENALI_STAGING_FINAL_APPROVAL_TOUR_ID);
    assert.equal(data.title, DENALI_STAGING_FINAL_APPROVAL_TOUR_TITLE);
    assert.equal(data.publishStatus, "active");
    assert.equal(data.capacityMax, 100);
    assert.equal(transport.mode, "airplane");
    assert.equal(transport.transportCost, 350_000);
    assert.equal(pricing.registrationApproval, "manual");
    assert.equal(pricing.paymentCollection, "offline");
    assert.equal(details.summary, DENALI_STAGING_FINAL_APPROVAL_TOUR_MARKER);
    assert.equal(isOwnedDenaliStagingFinalApprovalTour(tour, tenantId), true);
    assert.equal(isOwnedDenaliStagingFinalApprovalTour(tour, "other-tenant"), false);
    const unmarked = {
      ...tour,
      canonical: {
        ...tour.canonical,
        data: { ...tour.canonical.data, details: { summary: "existing unowned data" } },
      },
    };
    assert.equal(isOwnedDenaliStagingFinalApprovalTour(unmarked, tenantId), false);
  });

  it("DENALI-STAGING-FINAL-APPROVAL-02 refuses to seed outside staging before database access", async () => {
    const previousProfile = process.env.APP_INFRA_PROFILE;
    delete process.env.APP_INFRA_PROFILE;
    try {
      await assert.rejects(
        seedDenaliStagingFinalApprovalTour("00000000-0000-4000-8000-000000000003"),
        /DENALI_STAGING_FINAL_APPROVAL_PROFILE_REQUIRED/
      );
      process.env.APP_INFRA_PROFILE = "production";
      await assert.rejects(
        seedDenaliStagingFinalApprovalTour("00000000-0000-4000-8000-000000000003"),
        /DENALI_STAGING_FINAL_APPROVAL_PROFILE_REQUIRED/
      );
      process.env.APP_INFRA_PROFILE = "staging";
      await assert.rejects(
        seedDenaliStagingFinalApprovalTour("other-tenant"),
        /DENALI_STAGING_FINAL_APPROVAL_TENANT_MISMATCH/
      );
    } finally {
      if (previousProfile === undefined) delete process.env.APP_INFRA_PROFILE;
      else process.env.APP_INFRA_PROFILE = previousProfile;
    }
  });
});
