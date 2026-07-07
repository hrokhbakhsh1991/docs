import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  OPERATOR_SMOKE_PARTICIPANT_TOUR_ID,
  OPERATOR_SMOKE_PARTICIPANT_TOUR_TITLE,
  OPERATOR_SMOKE_PUBLISHED_TOUR_TITLE,
  OPERATOR_SMOKE_SEED_TOUR_ID,
  OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_ID,
  OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_TITLE,
  OPERATOR_SMOKE_TRANSPORT_SHARED_TOUR_ID,
  OPERATOR_SMOKE_TRANSPORT_SHARED_TOUR_TITLE,
  buildOperatorSmokeParticipantRequirementsTourCanonical,
  buildOperatorSmokePublishedTourCanonical,
  buildOperatorSmokeTransportBusTourCanonical,
  buildOperatorSmokeTransportSharedCarsTourCanonical,
} from "../src/fixtures/operator-smoke-published-tour.fixture";

describe("operator-smoke-published-tour.fixture.ts", () => {
  it("API-SMOKE-TPL-01 published tour canonical includes multi-day itinerary", () => {
    const canonical = buildOperatorSmokePublishedTourCanonical();
    assert.equal(canonical.data.title, OPERATOR_SMOKE_PUBLISHED_TOUR_TITLE);
    const program = canonical.data.program as {
      itinerary?: Array<{ title?: string; segments?: Array<{ title?: string }> }>;
    };
    assert.equal(program.itinerary?.length, 2);
    assert.equal(program.itinerary?.[0]?.title, "Summit push");
    assert.equal(program.itinerary?.[0]?.segments?.[0]?.title, "Ridge ascent");
    assert.equal(OPERATOR_SMOKE_SEED_TOUR_ID, "00000000-0000-4000-8000-000000000210");
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
      transportMode?: string;
      allowPersonalCar?: boolean;
      transportCost?: number;
    };
    assert.equal(canonical.data.title, OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_TITLE);
    assert.equal(transport.transportMode, "bus");
    assert.equal(transport.allowPersonalCar, true);
    assert.equal(transport.transportCost, 150_000);
    assert.equal(OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_ID, "00000000-0000-4000-8000-000000000213");
  });

  it("API-SMOKE-TPL-04 shared_cars transport tour canonical sets mode + dongAmount", () => {
    const canonical = buildOperatorSmokeTransportSharedCarsTourCanonical();
    const transport = canonical.data.transport as {
      transportMode?: string;
      dongAmount?: number;
    };
    assert.equal(canonical.data.title, OPERATOR_SMOKE_TRANSPORT_SHARED_TOUR_TITLE);
    assert.equal(transport.transportMode, "shared_cars");
    assert.equal(transport.dongAmount, 80_000);
    assert.equal(OPERATOR_SMOKE_TRANSPORT_SHARED_TOUR_ID, "00000000-0000-4000-8000-000000000214");
  });
});
