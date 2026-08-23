import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  readCapacityAtPath,
  sumOccupyingSeatsForStatus,
} from "../src/index";

describe("capacity ports (CW5-03)", () => {
  it("readCapacityAtPath reads nested workspace paths without vocabulary", () => {
    const denaliShape = { capacityMax: 12 };
    const urbanShape = { tour: { capacity: 8 } };
    assert.equal(readCapacityAtPath(denaliShape, ["capacityMax"]), 12);
    assert.equal(readCapacityAtPath(urbanShape, ["tour", "capacity"]), 8);
    assert.equal(readCapacityAtPath(urbanShape, []), null);
  });

  it("sumOccupyingSeatsForStatus preserves native status strings", () => {
    const rows = [
      { status: "approved", partySize: 2 },
      { status: "confirmed", partySize: 3 },
      { status: "waitlisted", partySize: 1 },
    ];
    assert.equal(sumOccupyingSeatsForStatus(rows, "approved"), 2);
    assert.equal(sumOccupyingSeatsForStatus(rows, "confirmed"), 3);
    assert.equal(sumOccupyingSeatsForStatus(rows, "waitlist"), 0);
  });
});
