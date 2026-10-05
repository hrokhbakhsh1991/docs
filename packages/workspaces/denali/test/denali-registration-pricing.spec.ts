import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sumParticipantPayableMinor } from "../src/catalog/registration-flow/denali-registration-pricing";

describe("Denali participant pricing summary", () => {
  it("BUG-STG-022 sums each participant payable, including transport/dong lines", () => {
    assert.equal(
      sumParticipantPayableMinor([{ payableMinor: "11000000" }, { payableMinor: "12000000" }]),
      "23000000"
    );
  });

  it("does not show a partial total while a preview is unavailable", () => {
    assert.equal(sumParticipantPayableMinor([{ payableMinor: "11000000" }, { payableMinor: "" }]), null);
  });
});
