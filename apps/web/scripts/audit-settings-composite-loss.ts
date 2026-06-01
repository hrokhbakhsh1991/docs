/**
 * Composite-loss audit: Settings preview save round-trip (itinerary-only / photos-only edits).
 *
 * Simulates: hydrate → edit one composite in preview → canonicalDataFromWizardForm (save)
 * → re-orchestrate (page reload) → verify sibling fields (category, title, photos).
 *
 * Usage:
 *   pnpm --filter web audit:settings-composite-loss
 *   pnpm --filter web audit:settings-composite-loss -- --markdown-out=../../audit-report.md
 */
import fs from "node:fs";
import path from "node:path";

import { denaliCanonicalToForm } from "@repo/denali-domain";
import type { DenaliCanonicalTemplateData } from "@repo/types/denali";

import { buildDenaliTourCreateDefaultValues } from "../src/features/tours/wizard/schemas/denaliCore.schema";
import { orchestrateDenaliWizardFromTemplate } from "../src/features/tours/wizard/domain/orchestrateDenaliWizardFromTemplate";
import {
  buildCanonicalCarryForwardFromTemplate,
  buildTourWizardTemplatePayloadFromForm,
  canonicalDataFromWizardForm,
} from "../lib/validation/tour-wizard-template-builder-form";
import type { TenantWizardTemplate } from "../src/features/tours/wizard/template/tenant-wizard-template.types";

const BASELINE_TITLE = "__COMPOSITE_BASELINE_TITLE__";
const BASELINE_DAY1 = "__COMPOSITE_BASELINE_DAY1__";
const EDITED_DAY1 = "__COMPOSITE_EDITED_ITINERARY_ONLY__";
const EDITED_PHOTO_FILENAME = "__COMPOSITE_EDITED_PHOTO_ONLY__.jpg";

const DESTINATION_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const THEME_ID = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const PHOTO_ID_A = "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";
const PHOTO_ID_B = "d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";

type FieldFingerprint = {
  category: string | undefined;
  duration: string | undefined;
  title: string | undefined;
  photosCount: number;
  firstPhotoFilename: string | undefined;
  itineraryDay1: string | undefined;
};

type RoundTripResult = {
  id: string;
  pass: boolean;
  detail: string;
  baseline: FieldFingerprint;
  afterSave: FieldFingerprint;
  afterReload: FieldFingerprint;
  checks: Record<string, boolean>;
};

type CompositeLossReport = {
  generatedAt: string;
  saveAdapter: string;
  scenarios: RoundTripResult[];
  adapterNote: string;
  pass: boolean;
};

function parseArgs(argv: string[]): { markdownOut: string | null; jsonOut: string | null } {
  const markdownOutArg = argv.find((arg) => arg.startsWith("--markdown-out="));
  const jsonOutArg = argv.find((arg) => arg.startsWith("--json-out="));
  return {
    markdownOut: markdownOutArg ? markdownOutArg.slice("--markdown-out=".length) : null,
    jsonOut: jsonOutArg ? jsonOutArg.slice("--json-out=".length) : null,
  };
}

function auditTemplate(canonicalData: Record<string, unknown>): TenantWizardTemplate {
  return {
    id: "tpl-composite-loss-audit",
    workspaceId: "ws-composite-loss-audit",
    baseProfile: "denali_pilot",
    stepOverrides: { skip: [], insert: [] },
    fieldRulesOverlay: {},
    presetId: null,
    canonicalData,
    wizardContractVersion: 1,
    formProfileVersion: 1,
  };
}

function galleryPhoto(
  id: string,
  filename: string,
): NonNullable<DenaliCanonicalTemplateData["photos"]>[number] {
  return {
    id,
    url: `https://cdn.example.test/${id}/${filename}`,
    filename,
    size: 2048,
    mimeType: "image/jpeg",
    uploadedAt: "2026-05-01T12:00:00.000Z",
  };
}

function buildRichBaselineCanonical(startDateTime: string): DenaliCanonicalTemplateData {
  return {
    category: "mountain",
    duration: "single",
    title: BASELINE_TITLE,
    destinationId: DESTINATION_ID,
    startDateTime,
    program: {
      themeIds: [THEME_ID],
      shortDescription: "Composite baseline short",
      itinerary: [{ day: 1, activities: BASELINE_DAY1 }],
    },
    transport: { mode: "none" },
    pricing: { paymentMode: "offline_receipt", requiresPayment: false },
    participants: {},
    policies: { policiesText: "" },
    photos: [galleryPhoto(PHOTO_ID_A, "baseline-a.jpg"), galleryPhoto(PHOTO_ID_B, "baseline-b.jpg")],
  };
}

function fingerprint(canonical: DenaliCanonicalTemplateData): FieldFingerprint {
  const photos = canonical.photos ?? [];
  return {
    category: canonical.category,
    duration: canonical.duration,
    title: canonical.title,
    photosCount: photos.length,
    firstPhotoFilename: photos[0]?.filename,
    itineraryDay1: canonical.program?.itinerary?.[0]?.activities,
  };
}

function fingerprintFromWizardForm(
  form: import("../src/features/tours/wizard/schemas/denaliCore.schema").DenaliCreateTourWizardForm,
): FieldFingerprint {
  const photos = form.photosData?.photos ?? [];
  return {
    category: undefined,
    duration: undefined,
    title: form.basicInfo.title,
    photosCount: photos.length,
    firstPhotoFilename: photos[0]?.filename,
    itineraryDay1: form.programNature.itinerary?.[0]?.activities,
  };
}

function fingerprintFromWizardTourType(
  form: import("../src/features/tours/wizard/schemas/denaliCore.schema").DenaliCreateTourWizardForm,
): Pick<FieldFingerprint, "category" | "duration"> {
  const tourType = form.basicInfo.tourType;
  if (!tourType) {
    return { category: undefined, duration: undefined };
  }
  try {
    const canonical = canonicalDataFromWizardForm(form);
    return { category: canonical.category, duration: canonical.duration };
  } catch {
    return { category: undefined, duration: undefined };
  }
}

async function hydrateForm(
  canonical: DenaliCanonicalTemplateData,
): Promise<import("../src/features/tours/wizard/schemas/denaliCore.schema").DenaliCreateTourWizardForm> {
  const template = auditTemplate(canonical as Record<string, unknown>);
  const result = await orchestrateDenaliWizardFromTemplate(
    template,
    canonical as Record<string, unknown>,
  );
  if (!result.success) {
    throw new Error(result.errors.join("; "));
  }
  return result.form;
}

/** Settings save path: full canonical replace (same as tour-wizard-template-builder-form submit). */
function settingsSaveCanonical(
  form: import("../src/features/tours/wizard/schemas/denaliCore.schema").DenaliCreateTourWizardForm,
  template: TenantWizardTemplate,
): DenaliCanonicalTemplateData {
  const payload = buildTourWizardTemplatePayloadFromForm(
    { fieldRulesOverlay: {} },
    [],
    {
      canonicalData: canonicalDataFromWizardForm(form, {
        carryForward: buildCanonicalCarryForwardFromTemplate(template),
      }),
    },
  );
  return payload.canonicalData as DenaliCanonicalTemplateData;
}

const VALID_START = "2026-06-15T08:00:00.000Z";

async function scenarioItineraryOnlyEdit(): Promise<RoundTripResult> {
  const baselineCanonical = buildRichBaselineCanonical(VALID_START);
  const baseline = fingerprint(baselineCanonical);

  const form = await hydrateForm(baselineCanonical);
  const edited = structuredClone(form);
  if (!edited.programNature.itinerary?.length) {
    edited.programNature.itinerary = [{ day: 1, activities: EDITED_DAY1 }];
  } else {
    edited.programNature.itinerary[0] = {
      ...edited.programNature.itinerary[0],
      day: 1,
      activities: EDITED_DAY1,
    };
  }

  const template = auditTemplate(baselineCanonical as Record<string, unknown>);
  const savedCanonical = settingsSaveCanonical(edited, template);
  const afterSave = fingerprint(savedCanonical);
  const reloadedForm = await hydrateForm(savedCanonical);
  const reloadedFormFp = fingerprintFromWizardForm(reloadedForm);
  const reloadedClassification = fingerprintFromWizardTourType(reloadedForm);
  const afterReload: FieldFingerprint = {
    ...reloadedFormFp,
    category: reloadedClassification.category,
    duration: reloadedClassification.duration,
  };

  const checks = {
    categoryUntouchedOnSave: baseline.category === afterSave.category,
    titleUntouchedOnSave: baseline.title === afterSave.title,
    photosUntouchedOnSave: baseline.photosCount === afterSave.photosCount,
    categoryUntouchedOnReload: baseline.category === afterReload.category,
    titleUntouchedOnReload: baseline.title === afterReload.title,
    photosInFormOnReload: afterReload.photosCount === baseline.photosCount,
    itineraryUpdatedOnSave: afterSave.itineraryDay1 === EDITED_DAY1,
    itineraryShownOnReload: afterReload.itineraryDay1 === EDITED_DAY1,
  };

  const pass = Object.values(checks).every(Boolean);

  return {
    id: "itinerary_only_edit_save_reload",
    pass,
    detail: pass
      ? "Itinerary-only: category/title preserved on save; itinerary updated; reload form matches"
      : `failed: ${Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k).join(", ")}`,
    baseline,
    afterSave,
    afterReload,
    checks,
  };
}

async function scenarioPhotosOnlyEdit(): Promise<RoundTripResult> {
  const baselineCanonical = buildRichBaselineCanonical(VALID_START);
  const baseline = fingerprint(baselineCanonical);

  const form = await hydrateForm(baselineCanonical);
  const edited = structuredClone(form);
  const photos = edited.photosData?.photos ?? [];
  if (photos.length > 0) {
    photos[0] = { ...photos[0], filename: EDITED_PHOTO_FILENAME };
  } else {
    edited.photosData = {
      photos: [
        {
          id: PHOTO_ID_A,
          url: `https://cdn.example.test/${PHOTO_ID_A}/${EDITED_PHOTO_FILENAME}`,
          filename: EDITED_PHOTO_FILENAME,
          size: 2048,
          mimeType: "image/jpeg",
          uploadedAt: "2026-05-01T12:00:00.000Z",
        },
      ],
    };
  }

  const template = auditTemplate(baselineCanonical as Record<string, unknown>);
  const savedCanonical = settingsSaveCanonical(edited, template);
  const afterSave = fingerprint(savedCanonical);
  const reloadedForm = await hydrateForm(savedCanonical);
  const reloadedFormFp = fingerprintFromWizardForm(reloadedForm);
  const reloadedClassification = fingerprintFromWizardTourType(reloadedForm);
  const afterReload: FieldFingerprint = {
    ...reloadedFormFp,
    category: reloadedClassification.category,
    duration: reloadedClassification.duration,
  };

  const checks = {
    categoryUntouchedOnSave: baseline.category === afterSave.category,
    titleUntouchedOnSave: baseline.title === afterSave.title,
    itineraryUntouchedOnSave: baseline.itineraryDay1 === afterSave.itineraryDay1,
    categoryUntouchedOnReload: baseline.category === afterReload.category,
    titleUntouchedOnReload: baseline.title === afterReload.title,
    itineraryInFormOnReload: afterReload.itineraryDay1 === baseline.itineraryDay1,
    photoEditPersistedOnSave: afterSave.firstPhotoFilename === EDITED_PHOTO_FILENAME,
    photoEditShownOnReload: afterReload.firstPhotoFilename === EDITED_PHOTO_FILENAME,
    photosCountOnSave: afterSave.photosCount === baseline.photosCount,
    photosCountInFormOnReload: afterReload.photosCount === baseline.photosCount,
  };

  const pass = Object.values(checks).every(Boolean);

  return {
    id: "photos_only_edit_save_reload",
    pass,
    detail: pass
      ? "Photos-only: siblings preserved; photo edit persisted through save/reload form"
      : `failed: ${Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k).join(", ")}`,
    baseline,
    afterSave,
    afterReload,
    checks,
  };
}

function scenarioAdapterExportsGalleryPhotos(): RoundTripResult {
  const defaults = buildDenaliTourCreateDefaultValues();
  const form = denaliCanonicalToForm(
    buildRichBaselineCanonical(VALID_START),
    defaults,
    { basics: { category: "mountain", duration: "single_day", eventVariant: undefined } },
  );
  const exported = canonicalDataFromWizardForm(form);
  const hasPhotos = (exported.photos?.length ?? 0) > 0;
  return {
    id: "save_adapter_exports_gallery_photos",
    pass: hasPhotos,
    detail: hasPhotos
      ? "canonicalDataFromWizardForm includes gallery photos"
      : "@repo/types/denali denaliCanonicalFromForm omits top-level photos (composite loss on any settings save)",
    baseline: fingerprint(buildRichBaselineCanonical(VALID_START)),
    afterSave: fingerprint(exported),
    afterReload: fingerprint(exported),
    checks: { galleryPhotosExported: hasPhotos },
  };
}

function formatMarkdown(report: CompositeLossReport): string {
  const lines = [
    "",
    "---",
    "",
    "## Composite-Loss Audit — Settings Preview Save / Reload (2026-06-01)",
    "",
    `**Procedure:** \`pnpm --filter web audit:settings-composite-loss\` (\`apps/web/scripts/audit-settings-composite-loss.ts\`)`,
    "",
    `**Generated:** ${report.generatedAt}`,
    "",
    `**Save adapter:** ${report.saveAdapter}`,
    "",
    `**Note:** ${report.adapterNote}`,
    "",
    "### Scenarios",
    "",
    "| Scenario | Pass | Detail |",
    "|----------|------|--------|",
  ];

  for (const scenario of report.scenarios) {
    lines.push(`| ${scenario.id} | ${scenario.pass ? "yes" : "**no**"} | ${scenario.detail} |`);
  }

  lines.push(
    "",
    "### Fingerprints (itinerary-only)",
    "",
  );

  const itinerary = report.scenarios.find((s) => s.id === "itinerary_only_edit_save_reload");
  if (itinerary) {
    lines.push(
      "| Stage | category | title | photos (canonical) | photos (form reload) | day1 |",
      "|-------|----------|-------|------------------|----------------------|------|",
      `| baseline | ${itinerary.baseline.category} | ${itinerary.baseline.title} | ${itinerary.baseline.photosCount} | — | ${itinerary.baseline.itineraryDay1} |`,
      `| after save | ${itinerary.afterSave.category} | ${itinerary.afterSave.title} | ${itinerary.afterSave.photosCount} | — | ${itinerary.afterSave.itineraryDay1} |`,
      `| after reload (form) | ${itinerary.afterReload.category} | ${itinerary.afterReload.title} | — | ${itinerary.afterReload.photosCount} | ${itinerary.afterReload.itineraryDay1} |`,
    );
  }

  const photos = report.scenarios.find((s) => s.id === "photos_only_edit_save_reload");
  if (photos) {
    lines.push(
      "",
      "### Fingerprints (photos-only)",
      "",
      "| Stage | category | title | photos | day1 |",
      "|-------|----------|-------|--------|------|",
      `| baseline | ${photos.baseline.category} | ${photos.baseline.title} | ${photos.baseline.photosCount} (${photos.baseline.firstPhotoFilename}) | ${photos.baseline.itineraryDay1} |`,
      `| after save | ${photos.afterSave.category} | ${photos.afterSave.title} | ${photos.afterSave.photosCount} (${photos.afterSave.firstPhotoFilename}) | ${photos.afterSave.itineraryDay1} |`,
      `| after reload (form) | ${photos.afterReload.category} | ${photos.afterReload.title} | ${photos.afterReload.photosCount} (${photos.afterReload.firstPhotoFilename}) | ${photos.afterReload.itineraryDay1} |`,
    );
  }

  const verdictRow = (
    label: string,
    scenario: RoundTripResult | undefined,
    stage: "save" | "reload",
    fields: Array<keyof FieldFingerprint>,
  ): string => {
    if (!scenario) {
      return `| ${label} | — | — | — | — |`;
    }
    const after = stage === "save" ? scenario.afterSave : scenario.afterReload;
    const cells = fields.map((field) => {
      const baselineVal = scenario.baseline[field];
      const afterVal = after[field];
      if (field === "photosCount") {
        return afterVal === baselineVal
          ? `preserved (${afterVal})`
          : `**lost (${afterVal})**`;
      }
      if (field === "itineraryDay1") {
        if (afterVal !== baselineVal && scenario.checks.itineraryUpdatedOnSave !== false) {
          return `updated (${afterVal})`;
        }
        return afterVal === baselineVal ? "preserved" : `**changed/lost**`;
      }
      if (field === "firstPhotoFilename") {
        if (afterVal !== baselineVal) {
          return `updated (${afterVal})`;
        }
        return "preserved";
      }
      return afterVal === baselineVal ? String(afterVal ?? "—") : "**null/lost**";
    });
    return `| ${label} | ${cells.join(" | ")} |`;
  };

  lines.push(
    "",
    "### Verdict (requested fields)",
    "",
    "| Edit scope | category | title | photos | itinerary |",
    "|------------|----------|-------|--------|-----------|",
    verdictRow("Itinerary-only → save (canonical)", itinerary, "save", [
      "category",
      "title",
      "photosCount",
      "itineraryDay1",
    ]),
    verdictRow("Itinerary-only → reload (preview form)", itinerary, "reload", [
      "category",
      "title",
      "photosCount",
      "itineraryDay1",
    ]),
    verdictRow("Photos-only → save / reload", photos, "reload", [
      "category",
      "title",
      "firstPhotoFilename",
      "itineraryDay1",
    ]),
    "",
    report.pass
      ? "**Overall:** **PASS** — single-field edits (itinerary-only, photos-only) do not null category, title, or sibling composites through Settings save → reload."
      : "**Overall:** **FAIL** — composite loss on partial edit; see failing scenario rows.",
    "",
    "**Artifact:** `apps/web/reports/settings-composite-loss.json`",
    "",
  );

  return lines.join("\n");
}

function appendMarkdown(markdownOut: string, section: string): void {
  const resolved = path.resolve(markdownOut);
  const existing = fs.existsSync(resolved) ? fs.readFileSync(resolved, "utf8") : "";
  const marker = "## Composite-Loss Audit — Settings Preview Save / Reload";
  let body: string;
  if (existing.includes(marker)) {
    const start = existing.indexOf(marker);
    const afterMarker = existing.slice(start + marker.length);
    const nextH2 = afterMarker.search(/\n## /);
    const end = nextH2 >= 0 ? start + marker.length + nextH2 : existing.length;
    body = `${existing.slice(0, start).replace(/\n+$/, "")}${section}${existing.slice(end)}`;
  } else {
    body = `${existing.replace(/\n+$/, "")}${section}`;
  }
  fs.writeFileSync(resolved, body, "utf8");
}

async function main(): Promise<void> {
  const { markdownOut, jsonOut } = parseArgs(process.argv.slice(2));

  const scenarios: RoundTripResult[] = [
    scenarioAdapterExportsGalleryPhotos(),
    await scenarioItineraryOnlyEdit(),
    await scenarioPhotosOnlyEdit(),
  ];

  const report: CompositeLossReport = {
    generatedAt: new Date().toISOString(),
    saveAdapter: "canonicalDataFromWizardForm → @repo/types/denali denaliCanonicalFromForm (Settings builder submit)",
    adapterNote:
      "Reload simulated by orchestrateDenaliWizardFromTemplate on saved canonical (same as settings page re-open). API persists full canonicalData replacement (no server-side field merge).",
    scenarios,
    pass: scenarios.every((scenario) => scenario.pass),
  };

  const jsonResolved = path.resolve(
    jsonOut ?? path.join(process.cwd(), "reports", "settings-composite-loss.json"),
  );
  fs.mkdirSync(path.dirname(jsonResolved), { recursive: true });
  fs.writeFileSync(jsonResolved, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Wrote ${jsonResolved}`);

  const mdTarget = markdownOut ?? path.resolve(process.cwd(), "../../audit-report.md");
  appendMarkdown(mdTarget, formatMarkdown(report));
  console.log(`Appended composite-loss section to ${path.resolve(mdTarget)}`);

  if (!report.pass) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
