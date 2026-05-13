import assert from "node:assert/strict";
import test from "node:test";

import { TOUR_TYPES, type TourType } from "./tour-classification";
import { defaultTourFormProfileForTourType } from "./tour-form-profile";
import {
  DEFAULT_TOUR_DOMAIN_PROFILE,
  TOUR_DOMAIN_PROFILE_VALUES,
  domainProfileFromTourTypeFallback,
  isTourDomainProfile,
  normalizeTourDomainProfileInput,
} from "./tour-domain-profile";
import { eventKindForDomainProfile } from "./tour-domain-profile-bridge";

test("eventKindForDomainProfile: total mapping covering all canonical profiles", () => {
  const mapping = TOUR_DOMAIN_PROFILE_VALUES.map((p) => [p, eventKindForDomainProfile(p)] as const);
  assert.deepEqual(mapping, [
    ["general", "generic"],
    ["mountain_outdoor", "mountain"],
    ["nature_trip", "generic"],
    ["urban_event", "city_tour"],
    ["cinema_event", "workshop"],
    ["cultural_tour", "cultural"],
  ]);
});

/* ---------------------------------------------------------------------------------------------
 * Invariant I-2: `domainProfileFromTourTypeFallback` is the **runtime alias** of
 * `defaultTourFormProfileForTourType`. The two names exist to signal intent at the call site —
 * if they ever diverge (e.g. someone replaces the alias with a separate implementation), the
 * canonical-truth claim collapses.
 * ------------------------------------------------------------------------------------------- */
test("I-2: domainProfileFromTourTypeFallback is reference-identical to defaultTourFormProfileForTourType", () => {
  assert.equal(
    domainProfileFromTourTypeFallback,
    defaultTourFormProfileForTourType,
    "alias must be the same function reference, not a wrapper",
  );
});

test("I-2: alias produces the same output as the underlying helper for every TourType", () => {
  for (const tourType of TOUR_TYPES) {
    assert.equal(
      domainProfileFromTourTypeFallback(tourType as TourType),
      defaultTourFormProfileForTourType(tourType as TourType),
      `mismatch for TourType ${tourType}`,
    );
  }
  assert.equal(domainProfileFromTourTypeFallback(null), defaultTourFormProfileForTourType(null));
  assert.equal(domainProfileFromTourTypeFallback(undefined), defaultTourFormProfileForTourType(undefined));
});

/* ---------------------------------------------------------------------------------------------
 * Aliases re-exported under canonical names should keep behavior parity with the underlying
 * `TourFormProfile` helpers they wrap. These pin the API surface so a future rename can't
 * silently drift.
 * ------------------------------------------------------------------------------------------- */
test("DEFAULT_TOUR_DOMAIN_PROFILE is in TOUR_DOMAIN_PROFILE_VALUES and predicates accept it", () => {
  assert.ok(TOUR_DOMAIN_PROFILE_VALUES.includes(DEFAULT_TOUR_DOMAIN_PROFILE));
  assert.equal(isTourDomainProfile(DEFAULT_TOUR_DOMAIN_PROFILE), true);
  assert.equal(isTourDomainProfile("not_a_profile"), false);
  assert.equal(normalizeTourDomainProfileInput("not_a_profile"), DEFAULT_TOUR_DOMAIN_PROFILE);
});
