import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseCreateTourBody } from "./create-tour.schema";

describe("createTourBodySchema (Zod)", () => {
  it("rejects unknown keys (strict mode)", () => {
    assert.throws(
      () => parseCreateTourBody({ data: { basics: { title: "x" } }, extra: true }),
      /ZOD_VALIDATION_FAILED/
    );
  });

  it("rejects non-positive schemaVersion", () => {
    assert.throws(
      () => parseCreateTourBody({ schemaVersion: 0, data: { basics: { title: "x" } } }),
      /ZOD_VALIDATION_FAILED/
    );
  });

  it("accepts valid minimal payload", () => {
    const body = parseCreateTourBody({
      data: { basics: { title: "Valid" }, details: { summary: "" } },
    });
    assert.equal(body.schemaVersion, undefined);
  });
});
