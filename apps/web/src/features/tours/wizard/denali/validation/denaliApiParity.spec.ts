/**
 * Cross-layer contract: web submit gate ↔ projection ↔ API denali_pilot invariants.
 *
 * API checks: {@link ../../../../../../../api/src/modules/tours/utils/denali-create-invariant-check.ts}
 */

import assert from "node:assert/strict";
import test from "node:test";

import { getTourWorkspaceDefinition } from "@repo/shared-contracts";
import type { CreateTourDto } from "@/lib/services/tours.service";
import type { DenaliTourKind } from "@repo/types";
import {
  buildDenaliTourCreateTestValues,
  getDenaliWizardSubmitIssues,
  buildDenaliWizardUploadTourPayload,
  denaliRuleSet,
  buildDenaliCreateTourPayloadProjection,
  mapDenaliWizardToCreateTourPayload,
  type DenaliCreateTourWizardForm,
} from "@/features/tours/testing/public-test-api";

type LayerStatus = "pass" | "blocked" | "throws";

type ScenarioExpectation = {
  web: LayerStatus;
  projection: LayerStatus;
  mapper: LayerStatus;
  api: LayerStatus;
  /** When API blocks, expected invariant code (workspace rules). */
  apiCode?: string;
};

type Scenario = {
  id: string;
  mutate: (_form: DenaliCreateTourWizardForm) => void;
  expect: ScenarioExpectation;
};

/** Registry test fixture with explicit classification (no silent mapper default). */
function mountainForm(): DenaliCreateTourWizardForm {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
  return form;
}

function clearTourType(form: DenaliCreateTourWizardForm): void {
  form.basicInfo.tourType = undefined as unknown as DenaliTourKind;
}

function evaluateWeb(form: DenaliCreateTourWizardForm): LayerStatus {
  return getDenaliWizardSubmitIssues(form).length === 0 ? "pass" : "blocked";
}

function evaluateProjection(form: DenaliCreateTourWizardForm): LayerStatus {
  try {
    buildDenaliCreateTourPayloadProjection(form);
    return "pass";
  } catch {
    return "throws";
  }
}

function evaluateMapper(form: DenaliCreateTourWizardForm): LayerStatus {
  try {
    mapDenaliWizardToCreateTourPayload(form);
    return "pass";
  } catch {
    return "throws";
  }
}

function evaluateApiFromMapper(form: DenaliCreateTourWizardForm): {
  status: LayerStatus;
  code?: string;
} {
  let dto: CreateTourDto;
  try {
    dto = mapDenaliWizardToCreateTourPayload(form);
  } catch {
    return { status: "throws" };
  }
  
  const ws = getTourWorkspaceDefinition("denali_pilot");
  if (!ws) return { status: "throws" };

  const capViolation = ws.validation.checkCapacity(dto.capacity);
  if (capViolation) return { status: "blocked", code: capViolation.code };

  const violation = ws.validation.checkTripDetails(dto.tripDetails, dto.transportModes as any);
  if (violation != null) {
    return { status: "blocked", code: violation.code };
  }
  return { status: "pass" };
}

/** Gallery staging shell: {@link buildDenaliWizardUploadTourPayload} + denali_pilot workspace rules. */
function evaluateStagingUploadApiContract(form: DenaliCreateTourWizardForm): {
  status: LayerStatus;
  code?: string;
  dto?: CreateTourDto;
} {
  let dto: CreateTourDto;
  try {
    dto = buildDenaliWizardUploadTourPayload({
      form,
      ruleSet: denaliRuleSet,
      workspaceFormProfile: "denali_pilot",
    });
  } catch {
    return { status: "throws" };
  }

  const ws = getTourWorkspaceDefinition("denali_pilot");
  if (!ws) {
    return { status: "throws" };
  }

  const capViolation = ws.validation.checkCapacity(dto.capacity);
  if (capViolation) {
    return { status: "blocked", code: capViolation.code, dto };
  }

  const tripViolation = ws.validation.checkTripDetails(dto.tripDetails, dto.transportModes as never);
  if (tripViolation != null) {
    return { status: "blocked", code: tripViolation.code, dto };
  }

  return { status: "pass", dto };
}

function assertLayerParity(scenario: Scenario, actual: {
  web: LayerStatus;
  projection: LayerStatus;
  mapper: LayerStatus;
  api: LayerStatus;
  apiCode?: string;
}): void {
  assert.equal(actual.web, scenario.expect.web, `${scenario.id}: web submit`);
  assert.equal(actual.projection, scenario.expect.projection, `${scenario.id}: projection`);
  assert.equal(actual.mapper, scenario.expect.mapper, `${scenario.id}: mapper`);
  assert.equal(actual.api, scenario.expect.api, `${scenario.id}: api`);
  if (scenario.expect.apiCode != null) {
    assert.equal(actual.apiCode, scenario.expect.apiCode, `${scenario.id}: api error code`);
  }
}

const SCENARIOS: Scenario[] = [
  {
    id: "capacityMax_zero",
    mutate: (f) => {
      f.basicInfo.capacityMax = 0;
    },
    expect: {
      web: "blocked",
      projection: "throws",
      mapper: "throws",
      api: "throws",
    },
  },
  {
    id: "missing_dongAmount",
    mutate: (f) => {
      f.transport.transportMode = "shared_cars";
      f.transport.dongAmount = undefined;
    },
    expect: {
      web: "blocked",
      projection: "pass",
      mapper: "pass",
      api: "blocked",
      apiCode: "WORKSPACE_RULE_DENALI_DONG_AMOUNT_REQUIRED",
    },
  },
  {
    id: "dongAmount_zero",
    mutate: (f) => {
      f.transport.transportMode = "shared_cars";
      f.transport.dongAmount = 0;
    },
    expect: {
      web: "blocked",
      projection: "pass",
      mapper: "pass",
      api: "blocked",
      apiCode: "WORKSPACE_RULE_DENALI_DONG_AMOUNT_REQUIRED",
    },
  },
  {
    id: "missing_fitnessLevel",
    mutate: (f) => {
      f.participantRequirements.fitnessLevel = undefined;
    },
    expect: {
      web: "blocked",
      projection: "pass",
      mapper: "pass",
      api: "blocked",
      apiCode: "WORKSPACE_RULE_DENALI_PARTICIPATION_FITNESS_LEVEL_REQUIRED",
    },
  },
  {
    id: "missing_minimumAge",
    mutate: (f) => {
      f.participantRequirements.minimumAge = undefined;
    },
    expect: {
      web: "blocked",
      projection: "pass",
      mapper: "pass",
      api: "blocked",
      apiCode: "WORKSPACE_RULE_DENALI_PARTICIPATION_MINIMUM_AGE_REQUIRED",
    },
  },
  {
    id: "valid_mountain_payload",
    mutate: (f) => {
      f.basicInfo.tourType = "mountain_day";
    },
    expect: {
      web: "pass",
      projection: "pass",
      mapper: "pass",
      api: "pass",
    },
  },
  {
    id: "invalid_payload",
    mutate: (f) => {
      clearTourType(f);
    },
    expect: {
      web: "blocked",
      projection: "throws",
      mapper: "throws",
      api: "throws",
    },
  },
];

test("denali api parity: mapped DTO without overview.denaliTourKind fails API create invariants", () => {
  const form = mountainForm();
  const dto = mapDenaliWizardToCreateTourPayload(form);
  const overview = { ...(dto.tripDetails?.overview as Record<string, unknown> | undefined) };
  delete overview.denaliTourKind;

  const ws = getTourWorkspaceDefinition("denali_pilot")!;
  const violation = ws.validation.checkTripDetails({ ...dto.tripDetails, overview } as any, dto.transportModes as any);
  assert.equal(violation?.code, "WORKSPACE_RULE_DENALI_TOUR_KIND_REQUIRED");
});

test("denali api parity: valid_mountain_payload — wizard submit and API mapper both pass", () => {
  const form = mountainForm();
  form.basicInfo.tourType = "mountain_day";

  assert.equal(evaluateWeb(form), "pass", "wizard submit gate must pass with explicit tourType");
  assert.equal(evaluateMapper(form), "pass", "mapper must pass with explicit tourType");
  assert.equal(
    evaluateApiFromMapper(form).status,
    "pass",
    "API invariants must pass after mapper with explicit tourType",
  );

  const dto = mapDenaliWizardToCreateTourPayload(form);
  const overview = dto.tripDetails?.overview as { denaliTourKind?: string } | undefined;
  assert.equal(overview?.denaliTourKind, "mountain_day");
});

test("denali api parity: invalid_payload — no tourType fails wizard and mapper (no silent default)", () => {
  const form = mountainForm();
  clearTourType(form);

  assert.equal(evaluateWeb(form), "blocked", "wizard must block when tourType is omitted");
  assert.equal(evaluateProjection(form), "throws", "projection must throw when tourType is omitted");
  assert.equal(evaluateMapper(form), "throws", "mapper must throw when tourType is omitted");
  assert.equal(
    evaluateApiFromMapper(form).status,
    "throws",
    "API path must not run invariants on a DTO built without tourType",
  );

  const issues = getDenaliWizardSubmitIssues(form);
  assert.ok(
    issues.some((i) => i.path.join(".") === "basicInfo.tourType"),
    "wizard issue must target basicInfo.tourType",
  );
  assert.throws(() => mapDenaliWizardToCreateTourPayload(form), /basicInfo\.tourType is required/);
});

test("denali api parity: staging upload payload passes denali_pilot API contract (checkTripDetails)", () => {
  const form = mountainForm();
  const staging = evaluateStagingUploadApiContract(form);
  const submit = evaluateApiFromMapper(form);

  assert.equal(
    staging.status,
    "pass",
    staging.code ?? "staging payload failed workspace invariants",
  );
  assert.equal(submit.status, "pass", submit.code ?? "submit mapper failed workspace invariants");

  const overview = staging.dto?.tripDetails?.overview as { denaliTourKind?: string } | undefined;
  assert.equal(overview?.denaliTourKind, "mountain_day");
  assert.equal(staging.dto?.lifecycle_status, "Draft");
});

test("denali api parity: valid mapper output includes denaliTourKind and API fitness slug", () => {
  const form = mountainForm();
  form.participantRequirements.fitnessLevel = "high";
  const dto = mapDenaliWizardToCreateTourPayload(form);
  const overview = dto.tripDetails?.overview as { denaliTourKind?: string } | undefined;
  assert.equal(overview?.denaliTourKind, "mountain_day");
  assert.equal(dto.tripDetails?.participation?.fitnessLevel, "hard");

  const ws = getTourWorkspaceDefinition("denali_pilot")!;
  const violation = ws.validation.checkTripDetails(dto.tripDetails, dto.transportModes as any);
  assert.equal(violation, null);
});

for (const scenario of SCENARIOS) {
  test(`denali api parity: ${scenario.id}`, () => {
    const form = mountainForm();
    scenario.mutate(form);

    const apiEval = evaluateApiFromMapper(form);
    const actual = {
      web: evaluateWeb(form),
      projection: evaluateProjection(form),
      mapper: evaluateMapper(form),
      api: apiEval.status,
      apiCode: apiEval.code,
    };

    assertLayerParity(scenario, actual);
  });
}

test("denali api parity matrix summary (documented expectations)", () => {
  for (const scenario of SCENARIOS) {
    const form = mountainForm();
    scenario.mutate(form);
    const api = evaluateApiFromMapper(form);
    const _row = [
      scenario.id,
      `${scenario.expect.web}/${evaluateWeb(form)}`,
      `${scenario.expect.projection}/${evaluateProjection(form)}`,
      `${scenario.expect.mapper}/${evaluateMapper(form)}`,
      `${scenario.expect.api}/${api.status}`,
      `${scenario.expect.apiCode ?? "—"}/${api.code ?? "—"}`,
    ].join(" | ");
  }
  assert.ok(SCENARIOS.length > 0);
});

test("denali api parity: capacityMax zero projection throws (no silent coerce)", () => {
  const form = mountainForm();
  form.basicInfo.capacityMax = 0;
  assert.throws(() => buildDenaliCreateTourPayloadProjection(form));
});
