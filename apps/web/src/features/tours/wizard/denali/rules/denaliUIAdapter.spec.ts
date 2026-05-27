import assert from "node:assert/strict";
import test from "node:test";

import {
  getDenaliUIAdapterMetadata,
  hiddenFields,
  isDenaliDurationAllowed,
  requiredFields,
  visibleFields,
} from "./denaliUIAdapter";

test("event + single_day: basic step UI metadata", () => {
  const basic = getDenaliUIAdapterMetadata({
    step: "denali_basic",
    category: "event",
    duration: "single_day",
  });
  assert.ok(basic);
  assert.ok(basic!.hiddenFields.includes("endDateTime"));
  assert.ok(!basic!.visibleFields.includes("endDateTime"));
});

test("event + single_day: photos step exposes relocated content fields", () => {
  const photosVisible = visibleFields("denali_photos", "event", "single_day");
  const photosRequired = requiredFields("denali_photos", "event", "single_day");

  assert.ok(photosVisible.includes("program.themeIds"));
  assert.ok(photosVisible.includes("program.shortDescription"));
  assert.ok(photosRequired.includes("program.shortDescription"));
});

test("event + single_day: program step hides outdoor fields and content", () => {
  const programVisible = visibleFields("denali_program", "event", "single_day");
  const programHidden = hiddenFields("denali_program", "event", "single_day");
  const programRequired = requiredFields("denali_program", "event", "single_day");

  assert.ok(!programVisible.includes("program.themeIds"));
  assert.ok(!programVisible.includes("program.shortDescription"));
  assert.ok(!programVisible.includes("program.difficultyLevel"));
  assert.ok(programHidden.includes("program.difficultyLevel"));
  assert.ok(programHidden.includes("program.hikingHoursApprox"));
  assert.ok(!programRequired.includes("program.difficultyLevel"));
});

test("event + single_day: multi_day model is absent", () => {
  const meta = getDenaliUIAdapterMetadata({
    step: "denali_basic",
    category: "event",
    duration: "multi_day",
  });
  assert.equal(meta, null);
});

test("isDenaliDurationAllowed matches rule set", () => {
  assert.equal(isDenaliDurationAllowed("desert", "multi_day"), true);
  assert.equal(isDenaliDurationAllowed("event", "multi_day"), false);
  assert.equal(isDenaliDurationAllowed("mountain", "single_day"), true);
});

test("event review metadata: participant paths are hidden not visible", () => {
  const hidden = hiddenFields("review", "event", "single_day");
  assert.ok(hidden.includes("participants.fitnessLevel"));
  assert.ok(hidden.includes("participants.minimumAge"));
  assert.ok(hidden.includes("participants.sportsInsuranceRequired"));
  const visible = visibleFields("review", "event", "single_day");
  assert.ok(!visible.includes("participants.fitnessLevel"));
});

test("mountain review metadata: participant paths visible on review", () => {
  const visible = visibleFields("review", "mountain", "single_day");
  assert.ok(visible.includes("participants.minimumAge"));
  assert.ok(visible.includes("participants.fitnessLevel"));
  assert.ok(visible.includes("participants.sportsInsuranceRequired"));
});
