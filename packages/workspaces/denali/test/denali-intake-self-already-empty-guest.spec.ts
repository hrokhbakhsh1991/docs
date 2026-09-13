import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const denaliRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("denali intake — Phase 3 self-already empty guest card", () => {
  it("DN-INTAKE-P3-01 selfTabLocked does not seed an empty other-guest draft", () => {
    const steps = readFileSync(
      join(denaliRoot, "src/catalog/registration-flow/denali-registration-flow.steps.tsx"),
      "utf8"
    );
    assert.match(steps, /if \(selfTabLocked\) return \[\];/);
    assert.match(steps, /data-denali-add-guest/);
    const lockStart = steps.indexOf("function lockSelfAsAlreadyRegistered");
    const lockEnd = steps.indexOf("const commonSessionContext");
    assert.ok(lockStart >= 0 && lockEnd > lockStart);
    assert.equal(steps.slice(lockStart, lockEnd).includes("createEmptyOtherDraft"), false);
    assert.doesNotMatch(
      steps,
      /const includeOther = selfTabLocked \|\| data\.registrantTarget === "other"/
    );
  });

  it("DN-INTAKE-P3-02 an existing self registration disables the self participant", () => {
    const steps = readFileSync(
      join(denaliRoot, "src/catalog/registration-flow/denali-registration-flow.steps.tsx"),
      "utf8"
    );
    assert.match(steps, /context\.existingSelfRegistrationId/);
    assert.match(steps, /const selfTabLocked = effectiveSelfRegistrationId !== null/);
    assert.match(steps, /!selfTabLocked && data\.registrantTarget === "self"/);
    assert.match(steps, /Never POST self when the gate already knows an active self registration/);
    assert.match(steps, /data-registration-self-already/);
  });

  it("DN-INTAKE-P3-03 every companion can be removed, including the last one", () => {
    const steps = readFileSync(
      join(denaliRoot, "src/catalog/registration-flow/denali-registration-flow.steps.tsx"),
      "utf8"
    );
    assert.match(steps, /readonly draftId: string/);
    assert.match(steps, /key=\{guest\.draftId\}/);
    assert.match(steps, /function removeGuest\(guestIdx: number\)/);
    assert.match(steps, /data-denali-undo-guest/);
    assert.doesNotMatch(steps, /otherGuests\.length > 1 \? \(/);
  });

  it("DN-INTAKE-P3-04 summary labels the amount per registration", () => {
    const steps = readFileSync(
      join(denaliRoot, "src/catalog/registration-flow/denali-registration-flow.steps.tsx"),
      "utf8"
    );
    assert.match(steps, /intake\.pricePerRegistration/);
    assert.match(steps, /intake\.separateRegistrationPrice/);
  });
});
