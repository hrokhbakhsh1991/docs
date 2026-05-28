import assert from "node:assert/strict";
import test from "node:test";

import { denaliCanonicalFromForm } from "@repo/types/denali";

import { buildDenaliTourCreateTestValues } from "./denaliCore.schema";
import { denaliCanonicalTourSchema } from "./denaliCanonicalTourSchema.unified";

test("denaliCanonicalTourSchema accepts unknown legacy keys (backward compatibility)", () => {
  const base = denaliCanonicalFromForm(buildDenaliTourCreateTestValues());
  const withLegacy = {
    ...base,
    programNature: { difficultyLevel: 1 },
  };
  const result = denaliCanonicalTourSchema.safeParse(withLegacy);
  assert.equal(result.success, true);
});

test("denaliCanonicalTourSchema accepts mapped mountain_day canonical shape", () => {
  const canonical = denaliCanonicalFromForm(buildDenaliTourCreateTestValues());
  const result = denaliCanonicalTourSchema.safeParse(canonical);
  assert.equal(result.success, true, result.success ? "" : JSON.stringify(result.error.issues));
});

test("denaliCanonicalTourSchema accepts optional itinerary photos", () => {
  const canonical = denaliCanonicalFromForm(buildDenaliTourCreateTestValues());
  const result = denaliCanonicalTourSchema.safeParse({
    ...canonical,
    duration: "multi",
    endDateTime: "2026-06-03T08:00:00.000Z",
    program: {
      ...canonical.program,
      itinerary: [
        {
          day: 1,
          activities: "Day one",
          photos: [{ id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22", url: "https://example.com/x.jpg" }],
        },
        { day: 2, activities: "Day two" },
        { day: 3, activities: "Day three" },
      ],
    },
  });
  assert.equal(result.success, true, result.success ? "" : JSON.stringify(result.error.issues));
});

test("denaliCanonicalTourSchema requires endDateTime when duration is multi", () => {
  const canonical = denaliCanonicalFromForm(buildDenaliTourCreateTestValues());
  const result = denaliCanonicalTourSchema.safeParse({
    ...canonical,
    duration: "multi",
    endDateTime: undefined,
  });
  assert.equal(result.success, false);
  assert.ok(result.error?.issues.some((i) => i.path.join(".") === "endDateTime"));
});

test("denaliCanonicalTourSchema rejects endDateTime before or equal to startDateTime", () => {
  const canonical = denaliCanonicalFromForm(buildDenaliTourCreateTestValues());
  const result = denaliCanonicalTourSchema.safeParse({
    ...canonical,
    duration: "multi",
    startDateTime: "2026-06-03T18:00:00.000Z",
    endDateTime: "2026-06-01T08:00:00.000Z",
  });
  assert.equal(result.success, false);
  assert.ok(
    result.error?.issues.some(
      (i) => i.path.join(".") === "endDateTime" && i.message.includes("بعد از زمان شروع"),
    ),
  );
});

test("denaliCanonicalTourSchema accepts multi-day end with same clock time on later date", () => {
  const canonical = denaliCanonicalFromForm(buildDenaliTourCreateTestValues());
  const result = denaliCanonicalTourSchema.safeParse({
    ...canonical,
    duration: "multi",
    startDateTime: "2026-06-01T08:00:00.000Z",
    endDateTime: "2026-06-03T08:00:00.000Z",
    program: {
      ...canonical.program,
      itinerary: [
        { day: 1, activities: "حرکت به اردوگاه" },
        { day: 2, activities: "صعود" },
        { day: 3, activities: "بازگشت" },
      ],
    },
  });
  assert.equal(result.success, true, result.success ? "" : JSON.stringify(result.error?.issues));
});
