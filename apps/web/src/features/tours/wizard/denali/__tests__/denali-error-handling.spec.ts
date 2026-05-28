import { ValidationError } from "zod-validation-error";

import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";

import {
  evaluateDenaliWizardSubmitGate,
  parseDenaliCanonicalFromWizardForm,
} from "../validation/denaliSubmitValidation";

function captureValidationError(run: () => unknown): ValidationError {
  try {
    run();
  } catch (error) {
    if (error instanceof ValidationError) {
      return error;
    }
    throw error;
  }
  throw new Error("expected parseDenaliCanonicalFromWizardForm to throw ValidationError");
}

function expectCanonicalValidationFailure(
  form: DenaliCreateTourWizardForm,
  fieldPath: string,
): void {
  expect(() => parseDenaliCanonicalFromWizardForm(form)).toThrow(ValidationError);

  const error = captureValidationError(() => parseDenaliCanonicalFromWizardForm(form));
  expect(error.message).toContain(fieldPath);
  expect(error.details.some((issue) => issue.path.join(".") === fieldPath)).toBe(true);
}

describe("evaluateDenaliWizardSubmitGate", () => {
  it("allows draft submit when form has validation issues", () => {
    const form = buildDenaliTourCreateTestValues();
    form.basicInfo.publishStatus = "draft";
    form.basicInfo.title = "short";

    const gate = evaluateDenaliWizardSubmitGate(form);
    expect(gate.success).toBe(true);
    expect(gate.submitIssues).toHaveLength(0);
  });

  it("blocks active submit when form or publish readiness fails", () => {
    const form = buildDenaliTourCreateTestValues();
    form.basicInfo.publishStatus = "active";
    form.basicInfo.title = "short";

    const gate = evaluateDenaliWizardSubmitGate(form);
    expect(gate.success).toBe(false);
    expect(gate.submitIssues.length + gate.publishIssues.length).toBeGreaterThan(0);
  });
});

describe("parseDenaliCanonicalFromWizardForm — negative / error handling", () => {
  it("throws ValidationError when title is too short", () => {
    const form = buildDenaliTourCreateTestValues();
    form.basicInfo.title = "short";

    expectCanonicalValidationFailure(form, "title");
    const error = captureValidationError(() => parseDenaliCanonicalFromWizardForm(form));
    expect(error.message).toMatch(/عنوان/);
  });

  it("throws ValidationError naming pricing.basePricePerPerson when paid tour has no price", () => {
    const form = buildDenaliTourCreateTestValues();
    form.pricingPayment.requiresPayment = true;
    form.pricingPayment.basePricePerPerson = undefined;

    expectCanonicalValidationFailure(form, "pricing.basePricePerPerson");
    const error = captureValidationError(() => parseDenaliCanonicalFromWizardForm(form));
    expect(error.message).toMatch(/قیمت/);
  });

  it("throws ValidationError naming capacityMax when maximum capacity is missing", () => {
    const form = buildDenaliTourCreateTestValues();
    form.basicInfo.capacityMax = undefined;

    expectCanonicalValidationFailure(form, "capacityMax");
    const error = captureValidationError(() => parseDenaliCanonicalFromWizardForm(form));
    expect(error.message).toMatch(/ظرفیت/);
  });

  it("throws ValidationError naming endDateTime when multi-day tour omits end", () => {
    const form = buildDenaliTourCreateTestValues();
    form.basicInfo.tourType = "nature_multi";
    form.basicInfo.endDateTime = undefined;

    expectCanonicalValidationFailure(form, "endDateTime");
    const error = captureValidationError(() => parseDenaliCanonicalFromWizardForm(form));
    expect(error.message).toMatch(/پایان/);
  });

  it("throws ValidationError naming endDateTime when end is not after start", () => {
    const form = buildDenaliTourCreateTestValues();
    form.basicInfo.tourType = "desert_multi";
    form.basicInfo.startDateTime = "2026-06-10T08:00:00.000Z";
    form.basicInfo.endDateTime = "2026-06-01T08:00:00.000Z";

    expectCanonicalValidationFailure(form, "endDateTime");
    const error = captureValidationError(() => parseDenaliCanonicalFromWizardForm(form));
    expect(error.message).toMatch(/بعد از زمان شروع/);
  });

  it("throws ValidationError naming transport.dongAmount when shared cars lacks dong amount", () => {
    const form = buildDenaliTourCreateTestValues();
    form.transport.transportMode = "shared_cars";
    form.transport.dongAmount = undefined;

    expectCanonicalValidationFailure(form, "transport.dongAmount");
    const error = captureValidationError(() => parseDenaliCanonicalFromWizardForm(form));
    expect(error.message).toMatch(/دنگ/);
  });
});
