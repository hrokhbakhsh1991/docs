import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";

import { ValidationError } from "zod-validation-error";

import { buildDenaliSubmitIssueViews } from "../denaliWizardSubmitIssuePresentation";
import { denaliRuleSet } from "../rules/denaliRuleModel";
import {
  parseDenaliCanonicalFromWizardForm,
  publishReadinessIssueToZodIssue,
} from "./denaliSubmitValidation";
import { submitValidDenaliWizardDefaults } from "@/features/tours/testing/denaliSubmitTestHelpers";

test("parseDenaliCanonicalFromWizardForm accepts default mountain_day form", () => {
  const canonical = parseDenaliCanonicalFromWizardForm(buildDenaliTourCreateTestValues());
  assert.equal(canonical.category, "mountain");
  assert.equal(canonical.duration, "single");
});

test("parseDenaliCanonicalFromWizardForm throws on invalid title", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.title = "short";
  assert.throws(
    () => parseDenaliCanonicalFromWizardForm(form),
    (err: unknown) => err instanceof ValidationError,
  );
});

test("publishReadinessIssueToZodIssue stamps path for DENALI_PUBLISH_PAYLOAD_UNBUILDABLE", () => {
  const issue = publishReadinessIssueToZodIssue({
    code: "DENALI_PUBLISH_PAYLOAD_UNBUILDABLE",
    message: "فرم هنوز برای ساخت درخواست انتشار کامل نیست.",
  });
  assert.deepEqual(issue.path, ["basicInfo", "publishStatus"]);
});

test("publish payload unbuildable issues route to review step in submit views", () => {
  const form = buildDenaliTourCreateTestValues();
  const zodIssue = publishReadinessIssueToZodIssue({
    code: "DENALI_PUBLISH_PAYLOAD_UNBUILDABLE",
    message: "فرم هنوز برای ساخت درخواست انتشار کامل نیست.",
    path: "basicInfo.publishStatus",
  });
  const t = ((key: string) => key) as Parameters<typeof buildDenaliSubmitIssueViews>[3];
  const [view] = buildDenaliSubmitIssueViews([zodIssue], form, denaliRuleSet, t);
  assert.equal(view?.formPath, "basicInfo.publishStatus");
  assert.equal(view?.stepId, "review");
});

test("submitValidDenaliWizardDefaults is step-order agnostic and includes photos-step content", () => {
  const form = submitValidDenaliWizardDefaults();
  assert.ok(
    (form.programNature.shortDescription ?? "").trim().length > 0,
    "default submit fixture must include shortDescription (denali_photos required field)",
  );
  assert.equal(parseDenaliCanonicalFromWizardForm(form).program?.shortDescription, form.programNature.shortDescription);
});
