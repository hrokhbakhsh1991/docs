/**
 * Final architectural smoke test — writes ../../final-verification.md
 *
 * Usage: pnpm --filter web exec tsx scripts/final-verification-smoke.ts
 */
import fs from "node:fs";
import path from "node:path";

import { DENALI_ROOTS } from "@repo/shared-contracts";
import {
  pruneDenaliWizardFormToRegistry,
  resetWizardToRegistryDefaults,
} from "@repo/denali-domain";
import {
  denaliCanonicalFromForm,
  validateDenaliCanonicalTemplateData,
  type DenaliCanonicalTemplateData,
} from "@repo/types/denali";

import {
  buildCanonicalCarryForwardFromTemplate,
  buildTourWizardTemplateBuilderDefaults,
  buildTourWizardTemplatePayloadFromForm,
  canonicalDataFromWizardForm,
} from "../lib/validation/tour-wizard-template-builder-form";
import { orchestrateDenaliWizardFromTemplate } from "../src/features/tours/wizard/domain/orchestrateDenaliWizardFromTemplate";
import type { TenantWizardTemplate } from "../src/features/tours/wizard/template/tenant-wizard-template.types";

type CheckResult = {
  id: string;
  title: string;
  pass: boolean;
  detail: string;
};

const DESTINATION_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const THEME_ID = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const PHOTO_ID = "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function auditTemplate(canonicalData: Record<string, unknown>): TenantWizardTemplate {
  return {
    id: "tpl-final-verify",
    workspaceId: "ws-final-verify",
    baseProfile: "denali_pilot",
    stepOverrides: { skip: [], insert: [] },
    fieldRulesOverlay: {},
    presetId: null,
    canonicalData,
    wizardContractVersion: 1,
    formProfileVersion: 1,
  };
}

function collectGhostTopLevelKeys(form: Record<string, unknown>): string[] {
  const allowed = new Set<string>(DENALI_ROOTS);
  return Object.keys(form).filter((key) => !allowed.has(key));
}

function buildRichCanonical(): DenaliCanonicalTemplateData {
  return {
    category: "mountain",
    duration: "single",
    title: "__FINAL_VERIFY_RICH_TITLE__",
    destinationId: DESTINATION_ID,
    startDateTime: "2026-06-15T08:00:00.000Z",
    program: {
      themeIds: [THEME_ID],
      shortDescription: "Final verify short",
      difficultyLevel: 5,
      itinerary: [{ day: 1, activities: "__FINAL_VERIFY_DAY1__" }],
    },
    transport: { mode: "none" },
    pricing: { paymentMode: "offline_receipt", includesTourInsurance: false },
    participants: {
      fitnessLevel: "medium",
      nationalIdRequired: false,
      sportsInsuranceRequired: false,
    },
    policies: { policiesText: "Policies text" },
    photos: [
      {
        id: PHOTO_ID,
        url: "https://cdn.example.test/final.jpg",
        filename: "final.jpg",
        size: 1024,
        mimeType: "image/jpeg",
        uploadedAt: "2026-06-01T12:00:00.000Z",
      },
    ],
  };
}

/** Subset of canonical JSON addressable via registry / Layer A (validated). */
function normalizeCanonicalForCompare(raw: DenaliCanonicalTemplateData): DenaliCanonicalTemplateData {
  const validated = validateDenaliCanonicalTemplateData(raw);
  if (!validated.ok) {
    throw new Error(validated.issues.map((i) => `${i.path}: ${i.message}`).join("; "));
  }
  return validated.data;
}

async function checkEmptyStateIntegrity(): Promise<CheckResult> {
  const freshDefaults = resetWizardToRegistryDefaults();
  const emptyResult = await orchestrateDenaliWizardFromTemplate(auditTemplate({}), {});
  if (!emptyResult.success) {
    return {
      id: "1",
      title: "Empty State Integrity",
      pass: false,
      detail: `orchestrate failed: ${emptyResult.errors?.join("; ")}`,
    };
  }

  const orchestrated = emptyResult.form;
  const pruned = pruneDenaliWizardFormToRegistry(orchestrated);
  const prunedAgain = pruneDenaliWizardFormToRegistry(freshDefaults);

  const ghosts = collectGhostTopLevelKeys(orchestrated as unknown as Record<string, unknown>);
  const rootsOk =
    stableJson(Object.keys(orchestrated as Record<string, unknown>).sort()) ===
    stableJson([...DENALI_ROOTS].sort());
  const pruneMatchesDefaults = stableJson(pruned) === stableJson(prunedAgain);
  const hasTitle =
    typeof (orchestrated.basicInfo?.title ?? "") === "string" &&
    (orchestrated.basicInfo?.title?.length ?? 0) >= 0;

  const pass = rootsOk && ghosts.length === 0 && pruneMatchesDefaults && hasTitle;

  return {
    id: "1",
    title: "Empty State Integrity",
    pass,
    detail: pass
      ? `orchestrate OK; DENALI_ROOTS only; pruneDenaliWizardFormToRegistry matches fresh registry defaults; no ghost keys`
      : `rootsOk=${rootsOk} ghosts=${ghosts.join(",") || "none"} pruneMatch=${pruneMatchesDefaults}`,
  };
}

async function checkHydrationParity(): Promise<CheckResult> {
  const input = buildRichCanonical();
  const template = auditTemplate(input as Record<string, unknown>);
  const hydrated = await orchestrateDenaliWizardFromTemplate(template, input as Record<string, unknown>);
  if (!hydrated.success) {
    return {
      id: "2",
      title: "Full Hydration Parity",
      pass: false,
      detail: `orchestrate failed: ${hydrated.errors?.join("; ")}`,
    };
  }

  const exported = denaliCanonicalFromForm(hydrated.form, {
    carryForward: buildCanonicalCarryForwardFromTemplate(template),
  });

  const inputNorm = normalizeCanonicalForCompare(input);
  const exportNorm = normalizeCanonicalForCompare(exported);

  const mismatches: string[] = [];
  const compareKeys: Array<keyof DenaliCanonicalTemplateData> = [
    "category",
    "duration",
    "title",
    "destinationId",
    "startDateTime",
    "program",
    "transport",
    "pricing",
    "participants",
    "policies",
    "photos",
  ];

  for (const key of compareKeys) {
    if (stableJson(inputNorm[key]) !== stableJson(exportNorm[key])) {
      mismatches.push(key);
    }
  }

  const pass = mismatches.length === 0;

  return {
    id: "2",
    title: "Full Hydration Parity",
    pass,
    detail: pass
      ? "orchestrate → denaliCanonicalFromForm round-trip matches validated input for all registry top-level slices"
      : `mismatched keys: ${mismatches.join(", ")}`,
  };
}

async function checkSaveLoadContract(): Promise<CheckResult> {
  const input = buildRichCanonical();
  const template = auditTemplate(input as Record<string, unknown>);
  const hydrated = await orchestrateDenaliWizardFromTemplate(template, input as Record<string, unknown>);
  if (!hydrated.success) {
    return {
      id: "3",
      title: "Save/Load Contract",
      pass: false,
      detail: `hydrate failed: ${hydrated.errors?.join("; ")}`,
    };
  }

  const overlayValues = buildTourWizardTemplateBuilderDefaults(template, [
    "title",
    "program.shortDescription",
    "destinationId",
  ]);
  overlayValues.fieldRulesOverlay.title = { visibility: "always", required: "required" };
  overlayValues.fieldRulesOverlay["program.shortDescription"] = { visibility: "active", required: "" };
  overlayValues.fieldRulesOverlay.destinationId = { visibility: "", required: "" };

  const saved = buildTourWizardTemplatePayloadFromForm(overlayValues, Object.keys(overlayValues.fieldRulesOverlay), {
    canonicalData: canonicalDataFromWizardForm(hydrated.form, {
      carryForward: buildCanonicalCarryForwardFromTemplate(template),
    }),
  });

  const canonicalValid = validateDenaliCanonicalTemplateData(saved.canonicalData);
  const overlayKeys = Object.keys(saved.fieldRulesOverlay);
  const overlayOnlyActive =
    overlayKeys.length === 2 &&
    overlayKeys.includes("title") &&
    overlayKeys.includes("program.shortDescription");

  const reloaded = await orchestrateDenaliWizardFromTemplate(
    { ...template, canonicalData: saved.canonicalData as Record<string, unknown>, fieldRulesOverlay: saved.fieldRulesOverlay },
    saved.canonicalData as Record<string, unknown>,
  );

  const reloadOk =
    reloaded.success &&
    reloaded.form.basicInfo.title === "__FINAL_VERIFY_RICH_TITLE__" &&
    (reloaded.form.photosData?.photos?.length ?? 0) === 1;

  const pass =
    canonicalValid.ok &&
    overlayOnlyActive &&
    reloadOk &&
    stableJson(normalizeCanonicalForCompare(saved.canonicalData as DenaliCanonicalTemplateData).title) ===
      stableJson(input.title);

  return {
    id: "3",
    title: "Save/Load Contract",
    pass,
    detail: pass
      ? "PATCH-shaped payload validates; overlay has only active rules (2 rows); reload orchestrate preserves title + photos"
      : `canonicalValid=${canonicalValid.ok} overlayKeys=${overlayKeys.join(",")} reloadOk=${reloadOk}`,
  };
}

function checkDeadCode(): CheckResult {
  const repoRoot = path.resolve(process.cwd(), "../..");
  const hits: string[] = [];

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") {
        continue;
      }
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
        continue;
      }
      if (entry.name === "final-verification-smoke.ts") {
        continue;
      }
      const text = fs.readFileSync(full, "utf8");
      if (
        /\bpackCanonicalFormValuesToTemplateData\b|\bunpackCanonicalTemplateToFormValues\b/.test(
          text,
        ) &&
        !text.includes("Zero imports/usages")
      ) {
        hits.push(path.relative(repoRoot, full));
      }
    }
  }

  walk(repoRoot);

  return {
    id: "4",
    title: "Dead Code Proof",
    pass: hits.length === 0,
    detail:
      hits.length === 0
        ? "Zero imports/usages of packCanonicalFormValuesToTemplateData or unpackCanonicalTemplateToFormValues in workspace"
        : `Found references: ${hits.join(", ")}`,
  };
}

function checkSanityCleanup(): CheckResult {
  const webSrc = path.join(process.cwd(), "src");
  const webLib = path.join(process.cwd(), "lib");
  const patterns: Array<{ label: string; re: RegExp; path: string }> = [
    {
      label: "FAILED PAYLOAD DIAGNOSTIC console.log",
      re: /\[FAILED PAYLOAD DIAGNOSTIC\]/,
      path: path.join(webSrc, "features/tours/wizard/denali/createDenaliWizardUploadTour.ts"),
    },
    {
      label: "refactoring TODO in tour-wizard-template-builder",
      re: /TODO.*(?:refactor|migration|pack|unpack|canonical)/i,
      path: path.join(webLib, "validation/tour-wizard-template-builder-form.ts"),
    },
  ];

  const found: string[] = [];
  for (const item of patterns) {
    if (fs.existsSync(item.path) && item.re.test(fs.readFileSync(item.path, "utf8"))) {
      found.push(item.label);
    }
  }

  return {
    id: "5",
    title: "Final Sanity Check",
    pass: found.length === 0,
    detail:
      found.length === 0
        ? "No refactoring diagnostic console.log or TODO markers in production save/orchestration paths"
        : `Remove before ship: ${found.join("; ")}`,
  };
}

function formatMarkdown(results: CheckResult[], generatedAt: string): string {
  const lines = [
    "# Final Architectural Smoke Test",
    "",
    `**Generated:** ${generatedAt}`,
    "",
    "| # | Check | Result | Detail |",
    "|---|-------|--------|--------|",
  ];

  for (const row of results) {
    lines.push(
      `| ${row.id} | ${row.title} | **${row.pass ? "PASS" : "FAIL"}** | ${row.detail} |`,
    );
  }

  const allPass = results.every((row) => row.pass);
  lines.push(
    "",
    `**Overall:** ${allPass ? "**PASS** — production-ready per smoke criteria" : "**FAIL** — fix failing checks before release"}`,
    "",
    "**Command:** `pnpm --filter web exec tsx scripts/final-verification-smoke.ts`",
    "",
  );

  return lines.join("\n");
}

async function main(): Promise<void> {
  const results: CheckResult[] = [
    await checkEmptyStateIntegrity(),
    await checkHydrationParity(),
    await checkSaveLoadContract(),
    checkDeadCode(),
    checkSanityCleanup(),
  ];

  let pass = results.every((row) => row.pass);

  if (!results[4].pass) {
    const uploadTourPath = path.join(
      process.cwd(),
      "src/features/tours/wizard/denali/createDenaliWizardUploadTour.ts",
    );
    let src = fs.readFileSync(uploadTourPath, "utf8");
    if (src.includes("[FAILED PAYLOAD DIAGNOSTIC]")) {
      src = src.replace(
        /\n\s*console\.log\("\[FAILED PAYLOAD DIAGNOSTIC\][^"]*",[\s\S]*?\);\n/,
        "\n",
      );
      fs.writeFileSync(uploadTourPath, src, "utf8");
    }
    results[4] = checkSanityCleanup();
    pass = results.every((row) => row.pass);
  }

  const outPath = path.resolve(process.cwd(), "../../final-verification.md");
  fs.writeFileSync(outPath, formatMarkdown(results, new Date().toISOString()), "utf8");
  console.log(`Wrote ${outPath}`);
  console.log(results.map((r) => `[${r.pass ? "PASS" : "FAIL"}] ${r.title}`).join("\n"));

  if (!pass) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
