import assert from "node:assert/strict";
import test from "node:test";

import type { DenaliCanonicalTourModel } from "@repo/types/denali";

import {
  canonicalDurationToRuleModelDuration,
  getDenaliRulesFromCanonical,
} from "./denaliCanonicalRuleAdapter";
import { getDenaliUIFromCanonical } from "./denaliUIAdapter";

const mountainSingle: Pick<DenaliCanonicalTourModel, "category" | "duration"> = {
  category: "mountain",
  duration: "single",
};

test("getDenaliRulesFromCanonical uses category and duration only", () => {
  const rules = getDenaliRulesFromCanonical(mountainSingle);
  assert.ok(rules);
  assert.equal(rules!.category, "mountain");
  assert.equal(rules!.duration, "single_day");
});

test("getDenaliRulesFromCanonical returns null for disallowed event + multi", () => {
  assert.equal(
    getDenaliRulesFromCanonical({ category: "event", duration: "multi" }),
    null,
  );
});

test("canonicalDurationToRuleModelDuration mapping", () => {
  assert.equal(canonicalDurationToRuleModelDuration("single"), "single_day");
  assert.equal(canonicalDurationToRuleModelDuration("multi"), "multi_day");
});

test("getDenaliUIFromCanonical matches slug-based event single_day visibility", () => {
  const canonical: DenaliCanonicalTourModel = {
    ...mountainSingle,
    title: "",
    destinationId: "",
    startDateTime: "",
    capacityMax: 1,
    program: { themeIds: [], shortDescription: "" },
    transport: { mode: "none" },
    pricing: { requiresPayment: true, basePricePerPerson: 500_000, paymentMode: "offline_receipt" },
    participants: {},
    policies: {},
    category: "event",
    duration: "single",
  };

  const ui = getDenaliUIFromCanonical(canonical);
  assert.ok(ui.ruleModel);
  assert.equal(ui.isVisible("denali_basic", "endDateTime"), false);
  assert.equal(ui.isVisible("denali_program", "program.difficultyLevel"), false);
  assert.equal(ui.isDurationAllowed("multi_day"), false);
});
