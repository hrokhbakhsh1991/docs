import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DENALI_FORM_PROFILE_GHOST_PATHS } from "../src/composites/denali-composite-anchors";
import {
  DENALI_LOCATION_ZONE_GHOST_PATHS,
  denaliLocationZoneOverviewPath,
  hasDenaliLocationAddressOrCoordinates,
  resolveDenaliLocationZoneFromStorage,
  toPersistableDenaliLocationData,
  toStoredDenaliLocationZoneValue,
  mergeDenaliLocationDataPatch,
  type DenaliLocationData,
} from "../src/ui/logic/denali-location-types";
import { resolveLocationConfirmPatch } from "../src/ui/logic/denali-location-modal-logic";
import { rebaseDraftChangeOntoLatest } from "../src/ui/logic/denali-tour-kind-field-logic";
import { getCanonicalValueFromDraft, setCanonicalValueOnDraft, type CanonicalWizardDraftEnvelope } from "../src/wizard/canonical-draft-access";
import { sanitizeDenaliWizardDraftEnvelope } from "../src/wizard/denali-wizard-draft-sanitize";
import { buildDenaliWizardRuleEvalContext } from "../src/wizard/denali-wizard-rule-eval-context";
import { loadDenaliWizardRulesModule } from "../src/wizard/denali-wizard-host-hooks";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const EDITOR_SRC = readFileSync(
  join(root, "src/ui/components/denali-location-point-editor.tsx"),
  "utf8"
);
const ASKLIM_CAMP = {
  label: "کمپ آبشار اسکلیم",
  address: "آبشار آهکی اسکلیم, لفور, سوادکوه شمالی",
  latitude: 36.16399,
  longitude: 52.76416,
} as const;

const QA_LOC_A = {
  address: "آدرس آزمایشی A",
  latitude: 35.7,
  longitude: 51.4,
} as const;

function applyCampPointLocationPatch(
  draft: CanonicalWizardDraftEnvelope,
  patch: Partial<DenaliLocationData>
): CanonicalWizardDraftEnvelope {
  const canonicalPath = "campPoint";
  const nestedPath = denaliLocationZoneOverviewPath("campPoint");
  const current = resolveDenaliLocationZoneFromStorage(
    getCanonicalValueFromDraft(draft, canonicalPath),
    getCanonicalValueFromDraft(draft, nestedPath)
  );
  const merged = mergeDenaliLocationDataPatch(current, patch);
  const stored = toStoredDenaliLocationZoneValue(merged);
  const withRoot = setCanonicalValueOnDraft(draft, canonicalPath, stored);
  return setCanonicalValueOnDraft(withRoot, nestedPath, stored);
}

function resolveCampPoint(draft: CanonicalWizardDraftEnvelope): DenaliLocationData {
  return resolveDenaliLocationZoneFromStorage(
    getCanonicalValueFromDraft(draft, "campPoint"),
    getCanonicalValueFromDraft(draft, denaliLocationZoneOverviewPath("campPoint"))
  );
}

function persistLikeWizardDraftChange(
  latest: CanonicalWizardDraftEnvelope,
  incoming: CanonicalWizardDraftEnvelope
): CanonicalWizardDraftEnvelope {
  return rebaseDraftChangeOntoLatest(latest, incoming);
}

describe("denali-location-zone-persist.spec.ts (ED-CAMP-PERSIST-01)", () => {
  it("DEN-CAMP-PERSIST-01 populated root wins over nested overview", () => {
    const resolved = resolveDenaliLocationZoneFromStorage(
      { label: "root camp" },
      { label: "nested camp", address: "لفور" }
    );
    assert.equal(resolved.label, "root camp");
  });

  it("DEN-CAMP-PERSIST-01 empty root falls back to populated nested overview", () => {
    const resolved = resolveDenaliLocationZoneFromStorage(null, ASKLIM_CAMP);
    assert.equal(resolved.label, ASKLIM_CAMP.label);
    assert.equal(resolved.address, ASKLIM_CAMP.address);
    assert.equal(resolved.latitude, ASKLIM_CAMP.latitude);
    assert.equal(resolved.longitude, ASKLIM_CAMP.longitude);
  });

  it("DEN-CAMP-PERSIST-01 persistable location drops osmName and empty pins", () => {
    assert.equal(toPersistableDenaliLocationData({}), undefined);
    assert.equal(toPersistableDenaliLocationData({ label: "  " }), undefined);
    const persisted = toPersistableDenaliLocationData({
      ...ASKLIM_CAMP,
      osmName: "must-not-persist",
    } as typeof ASKLIM_CAMP & { osmName: string });
    assert.deepEqual(persisted, { ...ASKLIM_CAMP });
    assert.equal(persisted && "osmName" in persisted, false);
  });

  it("DEN-CAMP-PERSIST-01 field dual-writes root and tripDetails.overview", () => {
    assert.match(EDITOR_SRC, /resolveDenaliLocationZoneFromStorage/);
    assert.match(EDITOR_SRC, /denaliLocationZoneOverviewPath/);
    assert.match(EDITOR_SRC, /toStoredDenaliLocationZoneValue/);
    assert.match(EDITOR_SRC, /mergeDenaliLocationDataPatch/);
    assert.match(EDITOR_SRC, /setCanonicalValue\(withRoot, nestedPath/);
  });

  it("DEN-CAMP-PERSIST-01 ghost strip list still includes summit/camp/end, not start", () => {
    for (const zone of DENALI_LOCATION_ZONE_GHOST_PATHS) {
      assert.equal(DENALI_FORM_PROFILE_GHOST_PATHS.has(zone), true);
      assert.equal(denaliLocationZoneOverviewPath(zone), `tripDetails.overview.${zone}`);
    }
    assert.equal(DENALI_FORM_PROFILE_GHOST_PATHS.has("startPoint"), false);
    assert.equal(DENALI_FORM_PROFILE_GHOST_PATHS.has("campPoint"), true);
  });

  it("DEN-CAMP-PERSIST-01 sanitize promotes root ghost onto overview", async () => {
    const rules = await loadDenaliWizardRulesModule();
    const ctx = buildDenaliWizardRuleEvalContext();
    const sanitized = sanitizeDenaliWizardDraftEnvelope(
      {
        data: {
          category: "nature_multi",
          campPoint: { ...ASKLIM_CAMP },
        },
      },
      rules,
      ctx
    );
    assert.deepEqual(
      getCanonicalValueFromDraft(sanitized, denaliLocationZoneOverviewPath("campPoint")),
      { ...ASKLIM_CAMP }
    );
  });

  it("DEN-CAMP-PERSIST-01 sanitize mirrors nested overview onto root for form adapter", async () => {
    const rules = await loadDenaliWizardRulesModule();
    const ctx = buildDenaliWizardRuleEvalContext();
    const sanitized = sanitizeDenaliWizardDraftEnvelope(
      {
        data: {
          category: "nature_multi",
          tripDetails: {
            overview: {
              trailDistanceKm: 8,
              campPoint: { ...ASKLIM_CAMP },
            },
          },
        },
      },
      rules,
      ctx
    );
    assert.deepEqual(getCanonicalValueFromDraft(sanitized, "campPoint"), { ...ASKLIM_CAMP });
    assert.equal(
      Number(getCanonicalValueFromDraft(sanitized, "tripDetails.overview.trailDistanceKm")),
      8
    );
  });

  it("DEF-LOC-001 clear confirm empties canonical location after draft rebase", () => {
    const latest: CanonicalWizardDraftEnvelope = {
      data: {
        category: "nature_multi",
        campPoint: { ...QA_LOC_A },
        tripDetails: { overview: { campPoint: { ...QA_LOC_A } } },
      },
    };
    const incoming = applyCampPointLocationPatch(latest, resolveLocationConfirmPatch({}));
    const persisted = persistLikeWizardDraftChange(latest, incoming);
    const resolved = resolveCampPoint(persisted);
    assert.equal(hasDenaliLocationAddressOrCoordinates(resolved), false);
    assert.equal(resolved.address, undefined);
    assert.equal(toPersistableDenaliLocationData(resolved), undefined);
  });

  it("DEF-LOC-001 clear cancel leaves canonical location unchanged", () => {
    const latest: CanonicalWizardDraftEnvelope = {
      data: {
        category: "nature_multi",
        campPoint: { ...QA_LOC_A },
        tripDetails: { overview: { campPoint: { ...QA_LOC_A } } },
      },
    };
    const before = resolveCampPoint(latest);
    const afterCancel = persistLikeWizardDraftChange(latest, latest);
    assert.deepEqual(resolveCampPoint(afterCancel), before);
  });

  it("DEF-LOC-001 clear confirm then reopen resolves empty canonical state", () => {
    const latest: CanonicalWizardDraftEnvelope = {
      data: {
        category: "nature_multi",
        campPoint: { ...QA_LOC_A },
        tripDetails: { overview: { campPoint: { ...QA_LOC_A } } },
      },
    };
    const cleared = persistLikeWizardDraftChange(
      latest,
      applyCampPointLocationPatch(latest, resolveLocationConfirmPatch({}))
    );
    const reopened = resolveCampPoint(cleared);
    assert.equal(hasDenaliLocationAddressOrCoordinates(reopened), false);
    assert.equal(reopened.address, undefined);
  });

  it("DEF-LOC-001 clear confirm preserves label without mutating it", () => {
    const latest: CanonicalWizardDraftEnvelope = {
      data: {
        category: "nature_multi",
        campPoint: { label: "کمپ", ...QA_LOC_A },
        tripDetails: { overview: { campPoint: { label: "کمپ", ...QA_LOC_A } } },
      },
    };
    const cleared = persistLikeWizardDraftChange(
      latest,
      applyCampPointLocationPatch(latest, resolveLocationConfirmPatch({}))
    );
    const resolved = resolveCampPoint(cleared);
    assert.equal(resolved.label, "کمپ");
    assert.equal(hasDenaliLocationAddressOrCoordinates(resolved), false);
  });

  it("DEF-LOC-001 modal clear patch does not mutate canonical before confirm apply", () => {
    const latest: CanonicalWizardDraftEnvelope = {
      data: {
        category: "nature_multi",
        campPoint: { ...QA_LOC_A },
      },
    };
    const clearPatch = resolveLocationConfirmPatch({});
    assert.deepEqual(clearPatch, {
      address: undefined,
      latitude: undefined,
      longitude: undefined,
    });
    assert.deepEqual(resolveCampPoint(latest), {
      address: QA_LOC_A.address,
      latitude: QA_LOC_A.latitude,
      longitude: QA_LOC_A.longitude,
    });
  });
});
