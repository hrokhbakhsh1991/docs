import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const denaliRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("denali intake birth date picker", () => {
  it("DN-INTAKE-CAL-01 registration intake uses neutral picker for birthDate only", () => {
    const intakeForm = readFileSync(
      join(denaliRoot, "src/catalog/registration-flow/denali-intake-form.tsx"),
      "utf8"
    );
    const steps = readFileSync(
      join(denaliRoot, "src/catalog/registration-flow/denali-registration-flow.steps.tsx"),
      "utf8"
    );
    const birthField = readFileSync(
      join(denaliRoot, "src/catalog/registration-flow/denali-intake-birth-date-field.tsx"),
      "utf8"
    );

    assert.match(intakeForm, /DenaliIntakeBirthDateField/);
    assert.match(intakeForm, /field\.id === "birthDate"/);
    assert.match(intakeForm, /RenderIntakeField/);
    assert.match(birthField, /@app-tour\/localized-calendar/);
    assert.match(birthField, /triggerDataAttributes/);
    assert.match(birthField, /data-intake-field/);
    assert.match(steps, /DenaliRenderIntakeForm/);
    assert.doesNotMatch(steps, /<RenderIntakeForm/);
    assert.doesNotMatch(steps, /from "@app-tour\/catalog-intake-ui"/);
  });

  it("DN-INTAKE-CAL-02 ledger skin imports calendar chrome for intake popover", () => {
    const ledger = readFileSync(join(denaliRoot, "theme/portal/registration-ledger.css"), "utf8");
    const wizardCalendar = readFileSync(join(denaliRoot, "theme/wizard-calendar.css"), "utf8");
    assert.match(ledger, /wizard-calendar\.css/);
    assert.match(ledger, /data-intake-field-block="birthDate"/);
    assert.match(wizardCalendar, /data-operator-wizard-calendar-popover/);
    assert.match(wizardCalendar, /data-operator-wizard-calendar-placement="top"/);
    assert.doesNotMatch(ledger, /data-intake-field-block="birthDate"[\s\S]*z-index:\s*70/);
  });
});
