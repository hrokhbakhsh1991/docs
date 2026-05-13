import assert from "node:assert/strict";
import test from "node:test";

import { TOUR_FORM_PROFILE_VERSION, type TourFormProfile } from "@repo/types";

import type { TourCreateFormValues } from "@/components/tours/wizard/schemas/tourCreateSchema";

import { sanitizeInactiveRootsForProfile } from "./fieldGroups";
import { buildTourCreateFormDefaultValues } from "./tourCreateFormDefaults";
import {
  parseWizardDraftRecord,
  serializeWizardDraft,
  WIZARD_DRAFT_STORAGE_KEY,
} from "./tourWizardDraftEnvelope";
import type { TourWizardDraftMeta } from "./tourWizardProfileResolve";

test("serializeWizardDraft embeds _wizardMeta and does not strip inactive-group data (raw watched snapshot)", () => {
  const meta: TourWizardDraftMeta = {
    resolvedFormProfile: "urban_event",
    formProfileVersion: TOUR_FORM_PROFILE_VERSION,
    themeIds: { main: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
  };
  const watched: Partial<TourCreateFormValues> = {
    overview: { title: "1234567890 عنوان تست" } as TourCreateFormValues["overview"],
    itinerary: {
      days: [
        {
          dayNumber: 1,
          title: "ghost-itinerary",
          description: "",
          segments: [{ title: "s", description: "", activityType: "hike" }],
        },
      ],
    } as TourCreateFormValues["itinerary"],
    participation: { minimumAge: 55 } as TourCreateFormValues["participation"],
  };
  const raw = serializeWizardDraft(watched, meta);
  assert.ok(raw.includes("ghost-itinerary"), "autosave path serializes watched as-is (no profile filter here)");
  assert.ok(raw.includes("_wizardMeta"));
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  assert.equal((parsed._wizardMeta as { resolvedFormProfile: string }).resolvedFormProfile, "urban_event");
});

test("parseWizardDraftRecord round-trips envelope from serializeWizardDraft", () => {
  const meta: TourWizardDraftMeta = {
    resolvedFormProfile: "cinema_event",
    formProfileVersion: TOUR_FORM_PROFILE_VERSION,
  };
  const watched: Partial<TourCreateFormValues> = {
    overview: { title: "cinema title" } as TourCreateFormValues["overview"],
  };
  const raw = serializeWizardDraft(watched, meta);
  const parsed = parseWizardDraftRecord(raw);
  assert.ok(parsed);
  assert.equal(parsed!.wizardMeta?.resolvedFormProfile, "cinema_event");
  assert.equal(parsed!.formPatch.overview?.title, "cinema title");
});

test("parseWizardDraftRecord returns null for empty string", () => {
  assert.equal(parseWizardDraftRecord(""), null);
  assert.equal(parseWizardDraftRecord("   "), null);
});

test("WIZARD_DRAFT_STORAGE_KEY is stable contract for TourCreateWizard", () => {
  assert.equal(WIZARD_DRAFT_STORAGE_KEY, "tour-create-wizard-draft-v1");
});

/* -------------------------------------------------------------------------- *
 * Auto-save sanitize chain — mirrors the production effect in
 * `TourCreateWizard.tsx`: when the live `resolvedProfile` flips, the very
 * next auto-save tick runs `sanitizeInactiveRootsForProfile(watched, profile)`
 * before `serializeWizardDraft(...)`, so the on-disk envelope never persists
 * data owned by groups that are inactive for the new profile.
 *
 * These tests pin the user-visible promise from the prompt:
 *   "اگر کاربر profile را از general به urban تغییر دهد، داده‌های
 *    itinerary / participation / logistics در snapshot ذخیره‌شده برای
 *    urban پاک شده‌اند."
 * -------------------------------------------------------------------------- */

/** Simulates the production sequence: sanitize against `resolvedProfile`, then serialize. */
function autosaveStringSimulatingTourCreateWizard(
  values: TourCreateFormValues,
  resolvedProfile: TourFormProfile,
  meta: TourWizardDraftMeta | undefined,
): string {
  const sanitized = sanitizeInactiveRootsForProfile(values, resolvedProfile);
  return serializeWizardDraft(sanitized as Partial<TourCreateFormValues>, meta);
}

test("autosave chain — general session with ghost roots: nothing is stripped while profile stays general", () => {
  const values = buildTourCreateFormDefaultValues();
  values.overview.title = "1234567890 عنوان عمومی";
  values.itinerary.days[0]!.title = "ghost-day-general";
  values.participation.requirements = "ghost-participation-general";
  values.logistics.primaryTransportMode = "bus";
  values.logistics.fuelShareToman = 500_000;

  const raw = autosaveStringSimulatingTourCreateWizard(values, "general", {
    resolvedFormProfile: "general",
    formProfileVersion: TOUR_FORM_PROFILE_VERSION,
  });
  const parsed = parseWizardDraftRecord(raw);
  assert.ok(parsed);
  assert.equal(parsed!.formPatch.itinerary?.days[0]?.title, "ghost-day-general");
  assert.equal(parsed!.formPatch.participation?.requirements, "ghost-participation-general");
  assert.equal(parsed!.formPatch.logistics?.primaryTransportMode, "bus");
  assert.equal(parsed!.formPatch.logistics?.fuelShareToman, 500_000);
});

test("autosave chain — user flips general → urban: itinerary / participation / logistics ghost is wiped from envelope", () => {
  // 1. Earlier in the session the user was on `general` and typed real content for
  //    itinerary / participation / logistics.
  const watched = buildTourCreateFormDefaultValues();
  watched.overview.title = "1234567890 عنوان قبل از تغییر";
  watched.itinerary.days[0]!.title = "should-disappear-itinerary";
  watched.itinerary.days[0]!.segments[0]!.title = "should-disappear-segment";
  watched.participation.requirements = "should-disappear-participation";
  watched.logistics.primaryTransportMode = "bus";
  watched.logistics.fuelShareToman = 250_000;

  // 2. The user picks an urban_event theme; `resolvedProfile` flips → next auto-save tick.
  const raw = autosaveStringSimulatingTourCreateWizard(watched, "urban_event", {
    resolvedFormProfile: "urban_event",
    formProfileVersion: TOUR_FORM_PROFILE_VERSION,
  });

  // 3. The serialized envelope must not contain any of the ghost values.
  assert.ok(!raw.includes("should-disappear-itinerary"), "itinerary day title must be stripped");
  assert.ok(!raw.includes("should-disappear-segment"), "itinerary segment title must be stripped");
  assert.ok(!raw.includes("should-disappear-participation"), "participation requirements must be stripped");
  assert.ok(
    !raw.includes('"primaryTransportMode":"bus"'),
    "logistics root must be reset to defaults (no `bus` mode on urban_event)",
  );

  // 4. Active root data (overview + the urban-relevant title) must survive untouched.
  const parsed = parseWizardDraftRecord(raw);
  assert.ok(parsed);
  assert.equal(parsed!.formPatch.overview?.title, "1234567890 عنوان قبل از تغییر");
  assert.equal(parsed!.wizardMeta?.resolvedFormProfile, "urban_event");

  // 5. The stripped roots must be exactly the canonical defaults — matching what the
  //    submit-time strip in `useTourWizardCreate` would have produced. The expected side
  //    is fed through `JSON.parse(JSON.stringify(...))` so `undefined`-valued keys (e.g.
  //    `participation.minimumAge`, `logistics.fuelShareToman`) are dropped consistently
  //    on both sides — same canonicalization the envelope itself goes through.
  const defaults = buildTourCreateFormDefaultValues();
  const jsonRoundtrip = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
  assert.deepEqual(parsed!.formPatch.itinerary, jsonRoundtrip(defaults.itinerary));
  assert.deepEqual(parsed!.formPatch.participation, jsonRoundtrip(defaults.participation));
  assert.deepEqual(parsed!.formPatch.logistics, jsonRoundtrip(defaults.logistics));
});

test("autosave chain — cinema_event flip preserves logistics (still an active group) but drops itinerary + participation", () => {
  const watched = buildTourCreateFormDefaultValues();
  watched.overview.title = "cinema-flip";
  watched.itinerary.days[0]!.title = "should-disappear-itinerary";
  watched.participation.requirements = "should-disappear-participation";
  watched.logistics.primaryTransportMode = "bus"; // logistics is *active* for cinema_event
  watched.logistics.fuelShareToman = 100_000;

  const raw = autosaveStringSimulatingTourCreateWizard(watched, "cinema_event", {
    resolvedFormProfile: "cinema_event",
    formProfileVersion: TOUR_FORM_PROFILE_VERSION,
  });

  assert.ok(!raw.includes("should-disappear-itinerary"));
  assert.ok(!raw.includes("should-disappear-participation"));
  // Asserts the *asymmetry* between cinema_event and urban_event: logistics survives.
  const parsed = parseWizardDraftRecord(raw);
  assert.ok(parsed);
  assert.equal(parsed!.formPatch.logistics?.primaryTransportMode, "bus");
  assert.equal(parsed!.formPatch.logistics?.fuelShareToman, 100_000);
});
