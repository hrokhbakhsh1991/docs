import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const portalRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../apps/portal");

describe("portal member profile birth date picker", () => {
  it("MP-CAL-01 profile form uses neutral picker adapter for birthDate only", () => {
    const form = readFileSync(join(portalRoot, "app/me/profile/member-profile-form.tsx"), "utf8");
    const birthField = readFileSync(
      join(portalRoot, "app/me/profile/member-profile-birth-date-field.tsx"),
      "utf8"
    );

    assert.match(form, /MemberProfileBirthDateField/);
    assert.match(form, /fieldId === "birthDate"/);
    assert.match(birthField, /@app-tour\/localized-calendar/);
    assert.match(birthField, /member-profile-calendar\.css/);
    assert.match(birthField, /collisionSelectors=\{\["\[data-member-profile-actions\]"\]\}/);
    assert.doesNotMatch(birthField, /@app-tour\/workspace-denali/);
    assert.doesNotMatch(form, /type=\{fieldInputType\(fieldId\)\}[\s\S]*birthDate/);
  });

  it("MP-CAL-02 portal package depends on localized-calendar only", () => {
    const pkg = readFileSync(join(portalRoot, "package.json"), "utf8");
    assert.match(pkg, /"@app-tour\/localized-calendar"/);
    assert.doesNotMatch(pkg, /"@app-tour\/workspace-denali"/);
  });
});
