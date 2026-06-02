import assert from "node:assert/strict";
import test from "node:test";

import {
  emitWizardRulesValidationFailure,
  tourProfileObservabilityWizardFailuresEnabled,
} from "./tourProfileObservability";

test("emitWizardRulesValidationFailure: no console when result is valid", () => {
  const calls: unknown[][] = [];
  // eslint-disable-next-line no-console
  const orig = console.warn;
  // eslint-disable-next-line no-console
  console.warn = (...a: unknown[]) => {
    calls.push(a);
  };
  process.env.NEXT_PUBLIC_TOUR_PROFILE_OBSERVABILITY = "1";
  try {
    emitWizardRulesValidationFailure({
      level: "submit",
      form_profile: "general",
      result: {
        isValid: true,
        ok: true,
        fieldErrors: {},
        issues: [],
        messages: [],
      },
    });
    assert.equal(calls.length, 0);
  } finally {
    // eslint-disable-next-line no-console
    console.warn = orig;
    delete process.env.NEXT_PUBLIC_TOUR_PROFILE_OBSERVABILITY;
  }
});

test("emitWizardRulesValidationFailure: emits one JSON line when invalid and obs enabled", () => {
  const calls: unknown[][] = [];
  // eslint-disable-next-line no-console
  const orig = console.warn;
  // eslint-disable-next-line no-console
  console.warn = (...a: unknown[]) => {
    calls.push(a);
  };
  process.env.NEXT_PUBLIC_TOUR_PROFILE_OBSERVABILITY = "1";
  try {
    assert.equal(tourProfileObservabilityWizardFailuresEnabled(), true);
    emitWizardRulesValidationFailure({
      level: "step_nav",
      form_profile: "mountain_outdoor",
      step_id: "basic",
      visible_step_ids: ["basic", "theme"],
      zod_trigger_ok: true,
      result: {
        isValid: false,
        ok: false,
        fieldErrors: { "overview.title": "x" },
        issues: [
          {
            path: "overview.title",
            pathSegments: ["overview", "title"],
            code: "required",
            message: "x",
          },
        ],
        messages: [],
      },
    });
    assert.equal(calls.length, 1);
    const line = String(calls[0]![0]);
    assert.ok(line.includes("tour_profile_obs"));
    const brace = line.indexOf("{");
    assert.ok(brace >= 0);
    const json = JSON.parse(line.slice(brace)) as { event: string; form_profile: string; issue_paths: string[] };
    assert.equal(json.event, "wizard_rules_validation_failed");
    assert.equal(json.form_profile, "mountain_outdoor");
    assert.deepEqual(json.issue_paths, ["overview.title"]);
  } finally {
    // eslint-disable-next-line no-console
    console.warn = orig;
    delete process.env.NEXT_PUBLIC_TOUR_PROFILE_OBSERVABILITY;
  }
});

test("emitWizardRulesValidationFailure: dedupes identical signature within window", () => {
  const calls: unknown[][] = [];
  // eslint-disable-next-line no-console
  const orig = console.warn;
  // eslint-disable-next-line no-console
  console.warn = (...a: unknown[]) => {
    calls.push(a);
  };
  process.env.NEXT_PUBLIC_TOUR_PROFILE_OBSERVABILITY = "1";
  const bad = {
    isValid: false,
    ok: false,
    fieldErrors: { "overview.title": "x" },
    issues: [
      {
        path: "overview.title",
        pathSegments: ["overview", "title"],
        code: "required" as const,
        message: "x",
      },
    ],
    messages: [] as const,
  };
  try {
    emitWizardRulesValidationFailure({ level: "step_nav", form_profile: "general", step_id: "basic", result: bad });
    emitWizardRulesValidationFailure({ level: "step_nav", form_profile: "general", step_id: "basic", result: bad });
    assert.equal(calls.length, 1, "second identical emission within dedupe window should be dropped");
  } finally {
    // eslint-disable-next-line no-console
    console.warn = orig;
    delete process.env.NEXT_PUBLIC_TOUR_PROFILE_OBSERVABILITY;
  }
});
