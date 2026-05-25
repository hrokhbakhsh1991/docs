/**
 * Denali draft contract (audit / TDD).
 *
 * Defines what a successful persisted draft JSON looks like **before** save/load
 * is migrated: flat `canonical` validated by `denaliCanonicalTourSchema`, plus
 * envelope metadata — not the 6-tab RHF `basicInfo` / `programNature` roots.
 *
 * Run via `pnpm test` (apps/web `tests/audit/` node:test glob).
 */

import assert from "node:assert/strict";
import test from "node:test";

import { DENALI_ROOTS } from "@repo/shared-contracts";

import {
  assertDenaliWizardDraftEnvelopeContract,
  buildGoldenDenaliWizardDraftEnvelope,
  buildGoldenDenaliWizardDraftMeta,
  DENALI_WIZARD_DRAFT_CONTRACT_KEYS,
  DENALI_WIZARD_DRAFT_OPTIONAL_KEYS,
  formatDenaliWizardDraftContractIssues,
  isLegacyRhfDenaliDraftEnvelope,
  parseDenaliWizardDraftEnvelope,
  validateDenaliWizardDraftEnvelopeContract,
} from "@/features/tours/wizard/denali/denaliWizardDraftContract";
import { readDenaliCanonicalBasics } from "@/features/tours/wizard/denali/denaliCanonicalBasicsControl";
import {
  denaliCanonicalToForm,
  denaliFormToCanonical,
} from "@/features/tours/wizard/denali/denaliCanonicalFormAdapter";
import { serializeDenaliWizardDraft } from "@/features/tours/wizard/denaliWizardDraftEnvelope";
import { mapDenaliDraftToCanonical } from "@/features/tours/wizard/domain/mapDenaliDraftToCanonical";
import { mapDenaliWizardToDraftPayload } from "@/features/tours/wizard/domain/mapDenaliWizardToDraftPayload";
import {
  buildDenaliTourCreateDefaultValues,
  buildDenaliTourCreateTestValues,
} from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import { denaliCanonicalTourSchema } from "@/features/tours/wizard/schemas/denaliCanonicalTourSchema.unified";

test("denali draft contract: documents required envelope keys", () => {
  assert.deepEqual(DENALI_WIZARD_DRAFT_CONTRACT_KEYS, [
    "_wizardRail",
    "versionHash",
    "canonical",
  ]);
  assert.deepEqual(DENALI_WIZARD_DRAFT_OPTIONAL_KEYS, ["_wizardMeta"]);
});

test("denali draft contract: golden mountain_day canonical passes unified schema", () => {
  const envelope = buildGoldenDenaliWizardDraftEnvelope({
    wizardMeta: buildGoldenDenaliWizardDraftMeta(),
  });

  const canonicalOnly = denaliCanonicalTourSchema.safeParse(envelope.canonical);
  assert.equal(
    canonicalOnly.success,
    true,
    canonicalOnly.success ? "" : formatDenaliWizardDraftContractIssues(canonicalOnly.error.issues),
  );

  assert.doesNotThrow(() => assertDenaliWizardDraftEnvelopeContract(envelope));
});

test("denali draft contract: rejects invalid canonical payload", () => {
  const envelope = buildGoldenDenaliWizardDraftEnvelope();
  const broken = {
    ...envelope,
    canonical: {
      ...envelope.canonical,
      category: "not-a-real-category",
    },
  };

  const result = validateDenaliWizardDraftEnvelopeContract(broken);
  assert.equal(result.success, false);
  assert.ok(
    result.success === false &&
      result.error.issues.some((i) => i.path[0] === "canonical"),
  );
});

test("denali draft contract: rejects envelope without canonical (missing payload)", () => {
  const envelope = buildGoldenDenaliWizardDraftEnvelope();
  const { canonical: _removed, ...withoutCanonical } = envelope;

  const result = validateDenaliWizardDraftEnvelopeContract(withoutCanonical);
  assert.equal(result.success, false);
});

test("denali draft contract: rejects legacy RHF-root draft JSON (pre-migration shape)", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";

  const legacyJson = serializeDenaliWizardDraft(form, buildGoldenDenaliWizardDraftMeta());
  const legacy = JSON.parse(legacyJson) as Record<string, unknown>;

  assert.ok(isLegacyRhfDenaliDraftEnvelope(legacy), "precondition: current serializer is RHF-rooted");
  for (const root of DENALI_ROOTS) {
    assert.ok(root in legacy, `legacy draft should still carry RHF root ${root}`);
  }
  assert.equal("canonical" in legacy, false);

  const result = validateDenaliWizardDraftEnvelopeContract(legacy);
  assert.equal(
    result.success,
    false,
    "legacy RHF envelope must fail until save/load persists `canonical`",
  );
  if (!result.success) {
    const paths = result.error.issues.map((i) => i.path.join(".") || "(root)");
    assert.ok(
      paths.some((p) => p === "canonical" || p.startsWith("canonical.")),
      `expected canonical-related issue, got: ${paths.join(", ")}`,
    );
  }
});

test("denali draft contract: save envelope round-trips to identical canonical via parse and mapDenaliDraftToCanonical", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";

  const sourceCanonical = mapDenaliDraftToCanonical(
    mapDenaliWizardToDraftPayload(form).canonical,
  );

  const golden = buildGoldenDenaliWizardDraftEnvelope({
    wizardMeta: buildGoldenDenaliWizardDraftMeta(),
  });
  const saveEnvelope = {
    ...golden,
    canonical: sourceCanonical,
  };

  const wire = JSON.parse(JSON.stringify(saveEnvelope)) as unknown;

  function parseDraft(raw: unknown) {
    return parseDenaliWizardDraftEnvelope(raw);
  }

  const parsed = parseDraft(wire);
  const reconstructed = mapDenaliDraftToCanonical(parsed.canonical);

  assert.deepEqual(
    reconstructed,
    sourceCanonical,
    "save → JSON → parse → mapDenaliDraftToCanonical must match normalized source",
  );

  const basics = readDenaliCanonicalBasics("mountain_day");
  const defaults = buildDenaliTourCreateDefaultValues();
  defaults.basicInfo.tourType = "mountain_day";
  const formReloaded = denaliCanonicalToForm(reconstructed, defaults, { basics });
  const roundTripCanonical = mapDenaliDraftToCanonical(denaliFormToCanonical(formReloaded));

  assert.deepEqual(
    roundTripCanonical,
    reconstructed,
    "canonical → form → canonical must match draft load model",
  );
});

test("denali draft contract: rejects stray top-level RHF keys alongside canonical", () => {
  const envelope = buildGoldenDenaliWizardDraftEnvelope();
  const hybrid = {
    ...envelope,
    basicInfo: { title: "hybrid leak" },
  };

  const result = validateDenaliWizardDraftEnvelopeContract(hybrid);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(
      result.error.issues.some((i) => i.code === "unrecognized_keys"),
      "strict envelope must reject RHF roots at top level",
    );
  }
});
