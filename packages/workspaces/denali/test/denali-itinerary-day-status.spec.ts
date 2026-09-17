import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDefaultItineraryDays,
  collectDenaliItineraryDayValidationIssues,
} from "../src/schemas/denaliItineraryDaySchema";
import {
  findFirstDenaliItineraryDayIssueIndex,
  resolveDenaliItineraryDayStatuses,
} from "../src/ui/logic/denali-itinerary-day-status";

describe("denali-itinerary-day-status", () => {
  it("marks complete days when title and segment title exist", () => {
    const days = buildDefaultItineraryDays(2);
    days[0] = {
      ...days[0],
      title: "Summit day",
      segments: [{ ...days[0].segments[0], title: "Ascent" }],
    };

    const statuses = resolveDenaliItineraryDayStatuses(days);
    assert.deepEqual(statuses, ["complete", "incomplete"]);
  });

  it("marks error days when validation is requested and content is missing", () => {
    const days = buildDefaultItineraryDays(2);
    days[0] = {
      ...days[0],
      title: "Day one",
      segments: [{ ...days[0].segments[0], title: "Hike" }],
    };

    const statuses = resolveDenaliItineraryDayStatuses(days, { showValidationErrors: true });
    assert.deepEqual(statuses, ["complete", "error"]);
    assert.ok(collectDenaliItineraryDayValidationIssues(days).length > 0);
    assert.equal(findFirstDenaliItineraryDayIssueIndex(days), 1);
  });
});
