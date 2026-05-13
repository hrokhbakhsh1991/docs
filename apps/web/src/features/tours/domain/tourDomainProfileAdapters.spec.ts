import assert from "node:assert/strict";
import test from "node:test";
import { Legacy } from "@repo/types";

const { eventKindForDomainProfile } = Legacy;

import {
  dualClassificationForEditForm,
  domainProfileFromEditFormValues,
  legacyEventKindFromEditFormValues,
} from "./tourDomainProfileAdapters";

test("domainProfileFromEditFormValues: falls back to tourType when no catalog", () => {
  assert.equal(
    domainProfileFromEditFormValues({
      themeCatalog: undefined,
      tourType: "mountain",
      mainTourThemeId: undefined,
      tripStyles: undefined,
    }),
    "mountain_outdoor",
  );
  assert.equal(
    domainProfileFromEditFormValues({
      themeCatalog: [],
      tourType: "city",
      mainTourThemeId: undefined,
      tripStyles: undefined,
    }),
    "urban_event",
  );
  assert.equal(
    domainProfileFromEditFormValues({
      themeCatalog: undefined,
      tourType: undefined,
      mainTourThemeId: undefined,
      tripStyles: undefined,
    }),
    "general",
  );
});

test("domainProfileFromEditFormValues: catalog hit takes precedence over tourType", () => {
  assert.equal(
    domainProfileFromEditFormValues({
      themeCatalog: [{ id: "theme-1", formProfile: "cinema_event" }],
      tourType: "mountain",
      mainTourThemeId: "theme-1",
      tripStyles: undefined,
    }),
    "cinema_event",
  );
});

test("legacyEventKindFromEditFormValues: matches resolveEventKindFromTourContext", () => {
  assert.equal(
    legacyEventKindFromEditFormValues({ tourType: "mountain", tripStyles: undefined }),
    "mountain",
  );
  assert.equal(
    legacyEventKindFromEditFormValues({ tourType: "city", tripStyles: undefined }),
    "city_tour",
  );
  assert.equal(
    legacyEventKindFromEditFormValues({ tourType: undefined, tripStyles: ["cultural"] }),
    "cultural",
  );
});

test("dualClassificationForEditForm: agrees when there is no catalog hit (tourType-only)", () => {
  const result = dualClassificationForEditForm({
    themeCatalog: undefined,
    tourType: "mountain",
    mainTourThemeId: undefined,
    tripStyles: undefined,
  });
  assert.equal(result.domainProfile, "mountain_outdoor");
  assert.equal(result.legacyEventKind, "mountain");
  assert.equal(result.projectedEventKind, "mountain");
  assert.equal(result.agrees, true);
});

test("dualClassificationForEditForm: EventKind values are adapter projections of domain profile", () => {
  const result = dualClassificationForEditForm({
    themeCatalog: [{ id: "cinema-theme", formProfile: "cinema_event" }],
    tourType: "mountain",
    mainTourThemeId: "cinema-theme",
    tripStyles: ["cultural"],
  });
  assert.equal(result.domainProfile, "cinema_event");
  assert.equal(
    result.projectedEventKind,
    eventKindForDomainProfile(result.domainProfile),
    "projectedEventKind must always be derived from domainProfile bridge mapping",
  );
});

test("dualClassificationForEditForm: surfaces disagreement when catalog overrides tourType", () => {
  const result = dualClassificationForEditForm({
    themeCatalog: [{ id: "city-theme", formProfile: "urban_event" }],
    tourType: "mountain",
    mainTourThemeId: "city-theme",
    tripStyles: undefined,
  });
  assert.equal(result.domainProfile, "urban_event");
  assert.equal(result.legacyEventKind, "mountain");
  assert.equal(result.projectedEventKind, "city_tour");
  assert.equal(result.agrees, false);
});

/* ---------------------------------------------------------------------------------------------
 * Invariant I-6: when `agrees: true`, the Phase B Edit Zod resolver's projected EventKind must
 * be byte-identical to the legacy resolver's EventKind. This pins the convergence guarantee:
 * Phase B only shifts behavior in the disagreement case, never in the (overwhelmingly common)
 * agreement case.
 * ------------------------------------------------------------------------------------------- */
test("I-6: every TourType-only input produces agreement and identical projected/legacy EventKind", () => {
  const tourTypes = ["mountain", "city", "nature", "cultural", "camp", "desert", "other"] as const;
  for (const tourType of tourTypes) {
    const result = dualClassificationForEditForm({
      themeCatalog: undefined,
      tourType: tourType as never,
      mainTourThemeId: undefined,
      tripStyles: undefined,
    });
    assert.equal(result.agrees, true, `expected agreement for tourType ${tourType}`);
    assert.equal(
      result.projectedEventKind,
      result.legacyEventKind,
      `${tourType}: projected/legacy diverged in the agreement case`,
    );
  }
});

test("I-6: empty-catalog input with no themeId also agrees (no catalog override possible)", () => {
  const result = dualClassificationForEditForm({
    themeCatalog: [{ id: "irrelevant", formProfile: "cinema_event" }],
    tourType: "mountain",
    mainTourThemeId: undefined,
    tripStyles: undefined,
  });
  assert.equal(result.agrees, true);
  assert.equal(result.projectedEventKind, result.legacyEventKind);
});
