/**
 * BUG-4 — intake success is a client `done` transition from POST 201, not an RSC wait.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const denaliRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("denali intake submit → done", () => {
  it("DN-INTAKE-DONE-01 handleSubmit transitions to done without router.refresh", () => {
    const steps = readFileSync(
      join(denaliRoot, "src/catalog/registration-flow/denali-registration-flow.steps.tsx"),
      "utf8"
    );
    assert.match(steps, /transitionFlowStep\(dispatch, "done"\)/);
    assert.doesNotMatch(steps, /router\.refresh/);
    assert.doesNotMatch(steps, /register\?_rsc/);
  });
});
