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
  applyOperatorSmokePublishedTourEditReadyPatch,
  buildOperatorSmokeParticipantRequirementsTourCanonical,
  buildOperatorSmokePublishedTourCanonical,
  buildOperatorSmokeTransportBusTourCanonical,
  buildOperatorSmokeTransportSharedCarsTourCanonical,
  isOperatorSmokePublishedTourEditReady,
  resolveOperatorSmokePublishedTourWindow,
} from "../src/fixtures/operator-smoke-published-tour.fixture";

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
});
