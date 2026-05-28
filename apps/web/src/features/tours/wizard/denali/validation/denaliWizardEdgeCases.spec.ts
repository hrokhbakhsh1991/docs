/**
 * Denali wizard edge-case QA matrix.
 *
 * | Area | Scenario | Expected |
 * |------|----------|----------|
 * | Mountain participants | fitnessLevel cleared on submit | submit fails: participantRequirements.fitnessLevel |
 * | Mountain participants | sportsInsuranceRequired false | submit passes (optional registration condition) |
 * | Mountain participants | minimumAge cleared | submit fails: participantRequirements.minimumAge |
 * | Mountain participants | nature_day missing fitness | submit passes (not in rule set) |
 * | Mountain participants | valid defaults | projection includes fitness + insurance |
 * | capacityMax | undefined / empty | submit + canonical fail capacityMax |
 * | capacityMax | 0 | submit gate + projection throw |
 * | capacityMax | valid ≥1 | submit passes capacity gate |
 * | dongAmount | shared_cars + missing | submit + transport step fail |
 * | dongAmount | shared_cars + 0 | submit fail (treated empty) |
 * | dongAmount | shared_cars + positive | submit pass; fuelShareToman set |
 * | dongAmount | non-shared + dong set | normalize clears dong; no dong error |
 * | Submit-only | fitness on program step | step issues omit participantRequirements |
 * | Submit-only | fitness on submit | submit issues include fitnessLevel |
 * | Submit-only | review apply validation | same as submit for fitnessLevel |
 * | UI visibility | dong | visible iff transportMode === shared_cars |
 * | UI visibility | price | visible iff requiresPayment |
 * | UI visibility | endDateTime | visible iff multi_day slug |
 * | UI visibility | outdoor program | visible mountain, hidden event |
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDenaliTourCreateDefaultValues,
  applyDenaliWizardStepValidation,
  getDenaliWizardStepIssues,
  getDenaliWizardSubmitIssues,
  validateDenaliWizardForm,
  findDenaliRuleField,
  getDenaliUIFromForm,
  denaliCanonicalWizardResolver,
  mapDenaliWizardToCreateTourPayload,
  collectDenaliRuleRequiredIssues,
  type DenaliRuleRequiredIssue,
  normalizeDenaliWizardForm,
  resolveDenaliRuleModelFromForm,
  buildDenaliCreateTourPayloadProjection,
} from "@/features/tours/testing/public-test-api";

function issuePaths(issues: { path: any[] }[]): string[] {
  return issues.map((i) => i.path.join("."));
}

function assertHasIssue(issues: { path: any[] }[], path: string): void {
  assert.ok(
    issues.some((i) => i.path.join(".") === path),
    `expected issue at ${path}, got: ${issuePaths(issues).join(", ")}`,
  );
}

function assertNoIssue(issues: { path: any[] }[], path: string): void {
  assert.ok(
    !issues.some((i) => i.path.join(".") === path),
    `unexpected issue at ${path}`,
  );
}

function mountainForm(): ReturnType<typeof buildDenaliTourCreateDefaultValues> {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "mountain_day";
  form.basicInfo.title = "Valid Mountain Title";
  form.basicInfo.capacityMax = 10;
  form.programNature.shortDescription = "Valid Description";
  form.programNature.difficultyLevel = 5;
  form.participantRequirements.minimumAge = 18;
  form.participantRequirements.fitnessLevel = "medium";
  form.participantRequirements.sportsInsuranceRequired = true;
  form.tripDetails = {
    ...form.tripDetails,
    overview: { ...form.tripDetails.overview, peakHeight: 4000 },
  };
  return form;
}

// --- Mountain participant requirements (submit_only) ---

test("submit: mountain_day requires fitnessLevel when cleared", () => {
  const form = mountainForm();
  form.participantRequirements.fitnessLevel = undefined;
  const result = validateDenaliWizardForm(form);
  assert.equal(result.success, false);
  assertHasIssue(result.issues, "participantRequirements.fitnessLevel");
});

test("submit: mountain_day allows sportsInsuranceRequired false", () => {
  const form = mountainForm();
  form.participantRequirements.sportsInsuranceRequired = false;
  const result = validateDenaliWizardForm(form);
  assertNoIssue(result.issues, "participantRequirements.sportsInsuranceRequired");
});

test("submit: mountain_day requires minimumAge when cleared", () => {
  const form = mountainForm();
  form.participantRequirements.minimumAge = undefined;
  const result = validateDenaliWizardForm(form);
  assert.equal(result.success, false);
  assertHasIssue(result.issues, "participantRequirements.minimumAge");
});

test("submit: nature_day does not require mountain submit_only fitnessLevel", () => {
  const form = mountainForm();
  form.basicInfo.tourType = "nature_day";
  form.participantRequirements.fitnessLevel = undefined;
  form.participantRequirements.sportsInsuranceRequired = undefined;
  form.participantRequirements.minimumAge = undefined;
  const result = validateDenaliWizardForm(form);
  assertNoIssue(result.issues, "participantRequirements.fitnessLevel");
  assertNoIssue(result.issues, "participantRequirements.sportsInsuranceRequired");
});

test("projection: mountain_day maps wizard fitness high → API hard on participation", () => {
  const form = mountainForm();
  form.participantRequirements.fitnessLevel = "high";
  form.participantRequirements.sportsInsuranceRequired = true;
  const dto = mapDenaliWizardToCreateTourPayload(form);
  assert.equal(dto.tripDetails?.participation?.fitnessLevel, "hard");
  assert.equal(dto.tripDetails?.participation?.sportsInsuranceRequired, true);
});

test("projection: nature_day omits mountain-only participant fields", () => {
  const form = mountainForm();
  form.basicInfo.tourType = "nature_day";
  form.participantRequirements.fitnessLevel = "medium";
  form.participantRequirements.sportsInsuranceRequired = true;
  const dto = mapDenaliWizardToCreateTourPayload(form);
  assert.equal(dto.tripDetails?.participation?.fitnessLevel, undefined);
  assert.equal(dto.tripDetails?.participation?.sportsInsuranceRequired, undefined);
});

test("resolver and submit agree on mountain participant failures", async () => {
  const form = mountainForm();
  form.participantRequirements.fitnessLevel = undefined;
  const submit = getDenaliWizardSubmitIssues(form);
  assertHasIssue(submit, "participantRequirements.fitnessLevel");

  const resolver = await denaliCanonicalWizardResolver(form, undefined, {
    criteriaMode: "all",
    fields: {},
    names: [],
    shouldUseNativeValidation: false,
  });
  const resolverErrors = resolver.errors as {
    participantRequirements?: { fitnessLevel?: { message?: string } };
  };
  assert.ok(resolverErrors.participantRequirements?.fitnessLevel?.message);
});

// --- capacityMax zero / empty ---

test("submit: undefined capacityMax fails before POST", () => {
  const form = mountainForm();
  form.basicInfo.capacityMax = undefined;
  const result = validateDenaliWizardForm(form);
  assert.equal(result.success, false);
  assertHasIssue(result.issues, "basicInfo.capacityMax");
});

test("submit: zero capacityMax fails (no silent coerce to valid capacity)", () => {
  const form = mountainForm();
  form.basicInfo.capacityMax = 0;
  const result = validateDenaliWizardForm(form);
  assert.equal(result.success, false);
  assertHasIssue(result.issues, "basicInfo.capacityMax");
});

test("submit: valid capacityMax passes capacity gate", () => {
  const form = mountainForm();
  form.basicInfo.capacityMax = 12;
  const result = validateDenaliWizardForm(form);
  assertNoIssue(result.issues, "basicInfo.capacityMax");
});

test("resolver: zero capacityMax surfaces basicInfo.capacityMax error", async () => {
  const form = mountainForm();
  form.basicInfo.capacityMax = 0;
  const resolver = await denaliCanonicalWizardResolver(form, undefined, {
    criteriaMode: "all",
    fields: {},
    names: [],
    shouldUseNativeValidation: false,
  });
  const errors = resolver.errors as { basicInfo?: { capacityMax?: { message?: string } } };
  assert.ok(errors.basicInfo?.capacityMax?.message);
});

// --- dongAmount required (shared_cars) ---

test("submit: shared_cars requires dongAmount when undefined", () => {
  const form = mountainForm();
  form.transport.transportMode = "shared_cars";
  form.transport.dongAmount = undefined;
  const result = validateDenaliWizardForm(form);
  assert.equal(result.success, false);
  assertHasIssue(result.issues, "transport.dongAmount");
});

test("submit: shared_cars rejects dongAmount zero", () => {
  const form = mountainForm();
  form.transport.transportMode = "shared_cars";
  form.transport.dongAmount = 0;
  const result = validateDenaliWizardForm(form);
  assert.equal(result.success, false);
  assertHasIssue(result.issues, "transport.dongAmount");
});

test("submit: shared_cars with positive dongAmount passes dong gate", () => {
  const form = mountainForm();
  form.transport.transportMode = "shared_cars";
  form.transport.dongAmount = 75_000;
  const result = validateDenaliWizardForm(form);
  assertNoIssue(result.issues, "transport.dongAmount");
});

test("transport step: shared_cars missing dong blocks step advance", () => {
  const form = mountainForm();
  form.transport.transportMode = "shared_cars";
  form.transport.dongAmount = undefined;
  const issues = getDenaliWizardStepIssues(form, "denali_logistics");
  assertHasIssue(issues, "transport.dongAmount");
});

test("normalize: organizer_vehicle clears stale dongAmount", () => {
  const form = mountainForm();
  form.transport.transportMode = "organizer_vehicle";
  form.transport.dongAmount = 99_000;
  const normalized = normalizeDenaliWizardForm(form);
  assert.equal(normalized.transport.dongAmount, undefined);
  const result = validateDenaliWizardForm(normalized);
  assertNoIssue(result.issues, "transport.dongAmount");
});

test("projection: shared_cars sets fuelShareToman only when dong is positive", () => {
  const form = mountainForm();
  form.transport.transportMode = "shared_cars";
  form.transport.dongAmount = 120_000;
  const withDong = buildDenaliCreateTourPayloadProjection(form);
  assert.equal(withDong.tripDetails?.logistics?.fuelShareToman, 120_000);

  form.transport.dongAmount = 0;
  const withoutDong = buildDenaliCreateTourPayloadProjection(form);
  assert.equal(withoutDong.tripDetails?.logistics?.fuelShareToman, undefined);
});

// --- Step scope (participant fields owned by denali_pricing) ---

test("rule engine step scope excludes denali_pricing participant paths on program step", () => {
  const form = mountainForm();
  form.participantRequirements.fitnessLevel = undefined;
  const model = resolveDenaliRuleModelFromForm(form)!;
  const stepIssues = collectDenaliRuleRequiredIssues(form, model, {
    mode: "step",
    stepId: "denali_program",
  });
  assert.ok(!stepIssues.some((i) => i.path.join(".") === "participantRequirements.fitnessLevel"));
});

test("rule engine submit scope includes denali_pricing minimumAge for mountain", () => {
  const form = mountainForm();
  form.participantRequirements.minimumAge = undefined;
  const model = resolveDenaliRuleModelFromForm(form)!;
  const issues: DenaliRuleRequiredIssue[] = collectDenaliRuleRequiredIssues(form, model, {
    mode: "submit",
  });
  assertHasIssue(issues, "participantRequirements.minimumAge");
});

test("getDenaliWizardStepIssues surfaces participant fields on pricing step", () => {
  const form = mountainForm();
  form.participantRequirements.minimumAge = undefined;
  const issues = getDenaliWizardStepIssues(form, "denali_pricing");
  assert.ok(issues.some((i) => i.path.join(".") === "participantRequirements.minimumAge"));
});

test("applyDenaliWizardStepValidation on pricing enforces required participant fields", () => {
  const form = mountainForm();
  form.participantRequirements.minimumAge = undefined;
  const errors: string[] = [];
  const ok = applyDenaliWizardStepValidation(
    form,
    "denali_pricing",
    (path) => {
      errors.push(String(path));
    },
    () => {},
  );
  assert.equal(ok, false);
  assert.ok(errors.includes("participantRequirements.minimumAge"));
  assert.ok(!errors.includes("participantRequirements.sportsInsuranceRequired"));
});

// --- UI visibility matches rule model ---

test("ui.isVisible: transport.dongAmount when shared_cars or bus+allowPersonalCar", () => {
  const form = mountainForm();
  const ui = getDenaliUIFromForm(form);

  form.transport.transportMode = "shared_cars";
  assert.equal(
    (ui as any).isVisible("denali_logistics", "transport.dongAmount", form),
    true,
    "dong row shown for shared_cars",
  );

  form.transport.transportMode = "bus";
  form.transport.allowPersonalCar = true;
  assert.equal(
    (ui as any).isVisible("denali_logistics", "transport.dongAmount", form),
    true,
    "dong row shown for bus + personal car",
  );

  form.transport.transportMode = "organizer_vehicle";
  form.transport.allowPersonalCar = undefined;
  assert.equal(
    (ui as any).isVisible("denali_logistics", "transport.dongAmount", form),
    false,
    "dong row hidden otherwise",
  );
});

test("ui.isVisible: pricing.basePricePerPerson only when requiresPayment", () => {
  const form = mountainForm();
  const ui = getDenaliUIFromForm(form);

  form.pricingPayment.requiresPayment = true;
  assert.equal(
    (ui as any).isVisible("denali_pricing", "pricing.basePricePerPerson", form),
    true,
  );

  form.pricingPayment.requiresPayment = false;
  assert.equal(
    (ui as any).isVisible("denali_pricing", "pricing.basePricePerPerson", form),
    false,
  );
});

test("ui.isVisible: endDateTime only for multi-day tourType", () => {
  const form = mountainForm();

  form.basicInfo.tourType = "mountain_multi";
  assert.equal(
    (getDenaliUIFromForm(form) as any).isVisible("denali_basic", "endDateTime", form),
    true,
    "re-resolve UI after tourType → mountain_multi",
  );

  form.basicInfo.tourType = "mountain_day";
  assert.equal(
    (getDenaliUIFromForm(form) as any).isVisible("denali_basic", "endDateTime", form),
    false,
    "re-resolve UI after tourType → mountain_day",
  );
});

test("ui.arePathsVisible: outdoor program block on mountain, not event", () => {
  const outdoor = ["program.difficultyLevel", "program.hikingHoursApprox"] as const;

  const mountain = mountainForm();
  mountain.basicInfo.tourType = "mountain_day";
  const mountainUi = getDenaliUIFromForm(mountain);
  assert.equal((mountainUi as any).arePathsVisible("denali_program", [...outdoor], mountain), true);

  const eventForm = mountainForm();
  eventForm.basicInfo.tourType = "event_cinema";
  const eventUi = getDenaliUIFromForm(eventForm);
  assert.equal((eventUi as any).arePathsVisible("denali_program", [...outdoor], eventForm), false);
});

test("ui.isVisibleInModel aligns with hidden rule flags for event outdoor paths", () => {
  const form = mountainForm();
  form.basicInfo.tourType = "event_cinema";
  const model = resolveDenaliRuleModelFromForm(form)!;
  const ui = getDenaliUIFromForm(form);

  assert.equal((ui as any).isVisibleInModel("program.difficultyLevel", form), false);
  assert.equal((ui as any).isVisibleInModel("program.hikingHoursApprox", form), false);
  assert.equal(findDenaliRuleField(model, "program.difficultyLevel")?.hidden, true);
});

const PARTICIPANT_REVIEW_PATHS = [
  "participants.minimumAge",
  "participants.fitnessLevel",
  "participants.sportsInsuranceRequired",
] as const;

test("ui.isVisible on review: mountain shows participant requirements", () => {
  const form = mountainForm();
  form.basicInfo.tourType = "mountain_day";
  const ui = getDenaliUIFromForm(form);
  for (const path of PARTICIPANT_REVIEW_PATHS) {
    assert.equal((ui as any).isVisible("review", path, form), true, `expected ${path} on review for mountain_day`);
  }
});

test("ui.isVisible on review: nature hides participant requirements", () => {
  const form = mountainForm();
  form.basicInfo.tourType = "nature_day";
  const ui = getDenaliUIFromForm(form);
  for (const path of PARTICIPANT_REVIEW_PATHS) {
    assert.equal((ui as any).isVisible("review", path, form), false, `expected ${path} hidden for nature_day`);
  }
});

test("ui.isVisible on review: event hides participant requirements", () => {
  const form = mountainForm();
  form.basicInfo.tourType = "event_cinema";
  const ui = getDenaliUIFromForm(form);
  for (const path of PARTICIPANT_REVIEW_PATHS) {
    assert.equal((ui as any).isVisible("review", path, form), false, `expected ${path} hidden for event_cinema`);
  }
});

test("applyDenaliWizardStepValidation on review fails when mountain participant fields cleared", () => {
  const form = mountainForm();
  form.participantRequirements.minimumAge = undefined;
  form.participantRequirements.fitnessLevel = undefined;
  const errorPaths: string[] = [];
  const ok = applyDenaliWizardStepValidation(
    form,
    "review",
    (path) => {
      errorPaths.push(String(path));
    },
    () => {},
  );
  assert.equal(ok, false);
  assert.ok(errorPaths.includes("participantRequirements.minimumAge"));
  assert.ok(errorPaths.includes("participantRequirements.fitnessLevel"));
  assert.ok(!errorPaths.includes("participantRequirements.sportsInsuranceRequired"));
});

test("ui + normalize: event tour clears outdoor values from form state", () => {
  const form = mountainForm();
  form.basicInfo.tourType = "event_reading";
  form.programNature.difficultyLevel = 2;
  form.programNature.hikingHoursApprox = 2;
  const normalized = normalizeDenaliWizardForm(form);
  assert.equal(normalized.programNature.difficultyLevel, undefined);
  assert.equal(normalized.programNature.hikingHoursApprox, undefined);
  const ui = getDenaliUIFromForm(normalized);
  assert.equal((ui as any).isVisible("denali_program", "program.difficultyLevel", normalized), false);
});
