/**
 * Forensic: semantic drift between Settings form packer and backend instantiate orchestrator.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  DENALI_MODERN_SETTINGS_OVERLAY_STORAGE_PATHS,
  denaliTemplateOrchestratorFactory,
} from "@repo/denali-domain";
import {
  DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS,
  templateToCanonical,
  validateDenaliCanonicalTemplateData,
} from "@repo/types/denali";

import { resolveModernTemplateBuilderFieldPaths } from "../../app/(app)/settings/tour-wizard-template/tour-wizard-template-section-groups";
import {
  packCanonicalFormValuesToTemplateData,
  unpackCanonicalTemplateToFormValues,
} from "./tour-wizard-template-builder-form";

const BUILDER_SEED_PATHS = resolveModernTemplateBuilderFieldPaths(
  DENALI_MODERN_SETTINGS_OVERLAY_STORAGE_PATHS,
);

const HYDRATABLE_TEMPLATE = {
  category: "mountain" as const,
  duration: "single" as const,
  title: "Semantic drift probe",
  program: { shortDescription: "Short", themeIds: [] as string[] },
};

/** Layer A top-level keys the orchestrator can consume but the builder never seeds/packs. */
const BACKEND_ONLY_TOP_LEVEL_PATHS = [
  "meetingPoint",
  "gatheringPoint",
  "publishStatus",
  "startPointLocationText",
] as const;

/** Layer A nested paths absent from builder seed paths (ghost + deprecated transport/pricing). */
const BACKEND_ONLY_NESTED_PATHS = [
  "pricing.paymentMode",
  "transport.transportNotes",
  "transport.seatPreference",
] as const;

/** Builder exposes this path but it is not Layer A JSON storage (stripped by templateToCanonical). */
const BUILDER_PHANTOM_PATHS = ["eventVariant"] as const;

test("semantic drift inventory: builder omits Layer A paths the backend orchestrator hydrates", () => {
  for (const path of BACKEND_ONLY_TOP_LEVEL_PATHS) {
    assert.equal(
      BUILDER_SEED_PATHS.includes(path),
      false,
      `expected builder to skip ${path}`,
    );
    assert.equal(
      (DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS as readonly string[]).includes(path),
      true,
      `expected Layer A to include ${path}`,
    );
  }

  for (const path of BACKEND_ONLY_NESTED_PATHS) {
    assert.equal(BUILDER_SEED_PATHS.includes(path), false, `expected builder to skip ${path}`);
  }

  for (const path of BUILDER_PHANTOM_PATHS) {
    assert.equal(BUILDER_SEED_PATHS.includes(path), true, `expected builder to expose ${path}`);
    assert.equal(
      (DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS as readonly string[]).includes(path),
      false,
      `expected Layer A to exclude phantom ${path}`,
    );
  }
});

test("pack round-trip preserves duration when builder seed path includes duration", async () => {
  const flat = unpackCanonicalTemplateToFormValues(HYDRATABLE_TEMPLATE, BUILDER_SEED_PATHS);
  const packed = packCanonicalFormValuesToTemplateData(flat);

  const validation = validateDenaliCanonicalTemplateData(packed);
  assert.equal(validation.ok, true, "packed payload must pass Layer A Zod");

  const orchestratorResult = await denaliTemplateOrchestratorFactory.createDraftFromTemplate({
    workspaceId: "ws-semantic-drift",
    templateId: "tpl-semantic-drift",
    canonicalData: packed,
    fieldRulesOverlay: {},
  });
  assert.equal(orchestratorResult.success, true, "orchestrator must not 422 on packed payload");

  assert.equal(
    packed.duration,
    HYDRATABLE_TEMPLATE.duration,
    "duration must survive pack round-trip so Preview matches POST instantiate classification",
  );
});

test("CRITICAL_VULNERABILITY: category without duration hydrates with default tourType (no 422)", async () => {
  const packed = packCanonicalFormValuesToTemplateData(
    unpackCanonicalTemplateToFormValues(
      { category: "mountain", title: "Partial", program: { shortDescription: "S", themeIds: [] } },
      BUILDER_SEED_PATHS,
    ),
  );

  assert.equal(validateDenaliCanonicalTemplateData(packed).ok, true);

  const partial = await denaliTemplateOrchestratorFactory.createDraftFromTemplate({
    workspaceId: "ws-partial",
    templateId: "tpl-partial",
    canonicalData: packed,
    fieldRulesOverlay: {},
  });
  const full = await denaliTemplateOrchestratorFactory.createDraftFromTemplate({
    workspaceId: "ws-partial",
    templateId: "tpl-partial",
    canonicalData: HYDRATABLE_TEMPLATE,
    fieldRulesOverlay: {},
  });

  assert.equal(partial.success, true);
  assert.equal(full.success, true);

  const partialTourType = (partial.draftState.data.form as { basicInfo?: { tourType?: string } })
    .basicInfo?.tourType;
  const fullTourType = (full.draftState.data.form as { basicInfo?: { tourType?: string } }).basicInfo
    ?.tourType;

  assert.notEqual(
    partialTourType,
    fullTourType,
    "classification must not silently diverge when duration is omitted by the form packer",
  );
});

test("CRITICAL_VULNERABILITY: eventVariant packed by frontend is stripped before backend templateToCanonical", () => {
  const packed = packCanonicalFormValuesToTemplateData({
    category: "event",
    eventVariant: "cinema",
    title: "Event tour",
    "program.shortDescription": "Short",
    "program.themeIds": [],
  });

  assert.equal(packed.eventVariant, "cinema");

  const sanitized = templateToCanonical({ canonicalData: packed });
  assert.equal(
    (sanitized as Record<string, unknown>).eventVariant,
    "cinema",
    "eventVariant must map into Layer A storage or fail loudly — templateToCanonical must not strip it silently",
  );
});

test("soft zombie: meetingPoint survives Layer A but is omitted by builder packer", () => {
  const canonical = {
    ...HYDRATABLE_TEMPLATE,
    meetingPoint: "North gate",
  };
  const flat = unpackCanonicalTemplateToFormValues(canonical, BUILDER_SEED_PATHS);
  const packed = packCanonicalFormValuesToTemplateData(flat);

  assert.equal(validateDenaliCanonicalTemplateData(packed).ok, true);
  assert.equal(packed.meetingPoint, "North gate");
});
