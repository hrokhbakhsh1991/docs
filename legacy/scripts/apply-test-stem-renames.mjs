#!/usr/bin/env node
/**
 * Rename stem-mismatched colocated tests under apps/web/src and apps/api/src.
 * Run from repo root: node scripts/apply-test-stem-renames.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

/** @type {[string, string][]} git mv pairs (relative paths) */
const RENAMES = [
  [
    "apps/web/src/features/tours/config/editTripDetailsWizardPathDivergence.spec.ts",
    "apps/web/src/features/tours/config/tripDetailsFieldConfigAdapter.spec.ts",
  ],
  [
    "apps/web/src/features/tours/config/fieldAccess.spec.ts",
    "apps/web/src/features/tours/config/editFieldRbac.spec.ts",
  ],
  [
    "apps/web/src/features/tours/edit/DenaliTourEditForm.spec.ts",
    "apps/web/src/features/tours/edit/updateTourDtoFromDenaliWizardForm.spec.ts",
  ],
  [
    "apps/web/src/features/tours/wizard/denali/rules/evaluateFormRules.conflict-resolution.spec.ts",
    "apps/web/src/features/tours/wizard/denali/rules/evaluateFormRules.spec.ts",
  ],
  [
    "apps/web/src/features/tours/wizard/denali/steps/__tests__/DenaliBasicInfoStep.navigation.spec.ts",
    "apps/web/src/features/tours/wizard/denali/steps/__tests__/DenaliBasicInfoStep.spec.ts",
  ],
  [
    "apps/web/src/features/tours/wizard/denali/steps/__tests__/denaliStepRelocation.spec.ts",
    "apps/web/src/features/tours/wizard/denali/denaliStepConfig.spec.ts",
  ],
  [
    "apps/web/src/features/tours/wizard/denali/utils/projection.spec.ts",
    "apps/web/src/features/tours/wizard/domain/buildDenaliCreateTourPayloadProjection.spec.ts",
  ],
  [
    "apps/web/src/features/tours/wizard/denali/validation/denaliGhostState.spec.ts",
    "apps/web/src/features/tours/wizard/denali/validation/denaliInvariantEngine.spec.ts",
  ],
  [
    "apps/web/src/features/tours/wizard/denali/validation/denaliNumericSafety.spec.ts",
    "apps/web/src/features/tours/wizard/denali/validation/denaliWizardFormZod.spec.ts",
  ],
  [
    "apps/web/src/features/tours/wizard/denali/validation/denaliPublishFlow.integration.spec.ts",
    "apps/web/src/features/tours/wizard/denali/validation/handleStatusChange.integration.spec.ts",
  ],
  [
    "apps/web/src/features/tours/wizard/domain/wizard-create-tour-wire-contract.spec.ts",
    "apps/web/src/features/tours/wizard/domain/createTourFromWizard.spec.ts",
  ],
  [
    "apps/web/src/features/tours/wizard/profileRules/profileRules.spec.ts",
    "apps/web/src/features/tours/wizard/profileRules/getProfileRules.spec.ts",
  ],
  [
    "apps/web/src/features/tours/wizard/schemas/denaliTourCreateSchema.spec.ts",
    "apps/web/src/features/tours/wizard/schemas/denaliTourCreateFormModel.spec.ts",
  ],
  [
    "apps/web/src/features/tours/wizard/tourWizardFormProfile.spec.ts",
    "apps/web/src/features/tours/wizard/tourWizardProfileResolve.spec.ts",
  ],
  [
    "apps/web/src/lib/form-rule-engine/formRuleEngine.denali.spec.ts",
    "apps/web/src/lib/form-rule-engine/createDenaliFormRuleEngine.spec.ts",
  ],
  [
    "apps/web/src/features/tours/wizard/denali/__tests__/DenaliReviewValidationSummary.integration.test.tsx",
    "apps/web/src/features/tours/wizard/denali/components/DenaliReviewValidationSummary.integration.test.tsx",
  ],
  [
    "apps/web/src/features/tours/wizard/denali/__tests__/DenaliNonAttendanceDetailsField.integration.test.tsx",
    "apps/web/src/features/tours/wizard/denali/steps/DenaliPricingStep.integration.test.tsx",
  ],
  [
    "apps/web/src/features/tours/wizard/denali/__tests__/DenaliWizardIntegrationAudit.integration.test.tsx",
    "apps/web/src/features/tours/wizard/denali/DenaliWizardSyncContext.integration.test.tsx",
  ],
  [
    "apps/web/src/features/tours/wizard/denali/validation/denaliCanonicalRules.integration.spec.ts",
    "apps/web/src/features/tours/wizard/schemas/denaliCanonicalTourSchema.unified.spec.ts",
  ],
  [
    "apps/api/src/modules/auth/auth.service.phone-otp.spec.ts",
    "apps/api/src/modules/auth/auth.service.spec.ts",
  ],
  [
    "apps/api/src/modules/draft-engine/postgres-draft-snapshot.store.spec.ts",
    "apps/api/src/modules/draft-engine/storage/postgres-draft-snapshot.store.spec.ts",
  ],
  [
    "apps/api/src/modules/finance/ledger/ledger-contract-enforcement.spec.ts",
    "apps/api/src/modules/finance/ledger/enforce-ledger-journal-contract.spec.ts",
  ],
  [
    "apps/api/src/modules/finance/payments/domain/payment-transition.spec.ts",
    "apps/api/src/modules/finance/payments/domain/payment-attempt-status.spec.ts",
  ],
  [
    "apps/api/src/modules/payments/payments-finance-contract-enforcement.spec.ts",
    "apps/api/src/modules/payments/enforce-payment-intent-finance-contract.spec.ts",
  ],
  [
    "apps/api/src/modules/pricing/calculate-quote.finance-parity.spec.ts",
    "apps/api/src/modules/finance/pricing/calculate-quote.spec.ts",
  ],
  [
    "apps/api/src/modules/registrations/domain/booking-transition.spec.ts",
    "apps/api/src/modules/registrations/domain/booking-status.spec.ts",
  ],
  [
    "apps/api/src/modules/registrations/dto/create-registration-transport.dto.spec.ts",
    "apps/api/src/modules/registrations/dto/create-registration.dto.spec.ts",
  ],
  [
    "apps/api/src/modules/settings-locations/tour-creation-presets-settings.service.drift.spec.ts",
    "apps/api/src/modules/settings-locations/tour-creation-presets-settings.service.spec.ts",
  ],
  [
    "apps/api/src/modules/tours/fitness.spec.ts",
    "apps/api/src/modules/tours/tours.module.spec.ts",
  ],
  [
    "apps/api/src/modules/tours/policies/denali-publish-geolocation.spec.ts",
    "apps/api/src/modules/tours/types/tour-trip-details.types.spec.ts",
  ],
  [
    "apps/api/src/modules/tours/policies/tours-lifecycle-transitions.spec.ts",
    "apps/api/src/modules/tours/policies/assert-tour-publish-transition.spec.ts",
  ],
  [
    "apps/api/src/modules/tours/tours-sync-catalog.unit-spec.ts",
    "apps/api/src/modules/tours/tours.service.unit-spec.ts",
  ],
  [
    "apps/api/src/database/__tests__/outbox-tenant.spec.ts",
    "apps/api/src/database/runtime-schema-guard.service.integration.spec.ts",
  ],
  [
    "apps/api/src/database/__tests__/tenant-rls.integration.spec.ts",
    "apps/api/src/database/tenant-db-context.service.integration.spec.ts",
  ],
  [
    "apps/api/src/database/__tests__/tenant-scoped-tables-rls.integration.spec.ts",
    "apps/api/src/common/tenant/tenant-runtime-guard.service.integration.spec.ts",
  ],
];

/** @type {{ sources: string[], target: string }[]} */
const MERGES = [
  {
    target: "apps/web/src/features/tours/wizard/denali/rules/denaliUIAdapter.spec.ts",
    sources: [
      "apps/web/src/features/tours/wizard/denali/rules/denaliUIAdapter.wizard.spec.ts",
    ],
  },
  {
    target: "apps/web/src/features/tours/wizard/denali/rules/evaluateFormRules.spec.ts",
    sources: [
      "apps/web/src/features/tours/wizard/denali/rules/evaluateFormRules.train-seat-preference.spec.ts",
    ],
  },
  {
    target: "apps/web/src/features/tours/wizard/denali/rules/denaliRuleRequired.spec.ts",
    sources: [
      "apps/web/src/features/tours/wizard/denali/rules/denaliWorkspaceFieldOverlay.spec.ts",
      "apps/web/src/features/tours/wizard/denali/rules/integrity.spec.ts",
    ],
  },
  {
    target: "apps/web/src/features/tours/wizard/denali/validation/denaliRuleAccess.spec.ts",
    sources: [
      "apps/web/src/features/tours/wizard/denali/validation/denaliRuleValidation.spec.ts",
      "apps/web/src/features/tours/wizard/denali/validation/denaliTransportPersonalCar.spec.ts",
    ],
  },
  {
    target: "apps/web/src/features/tours/wizard/schemas/denaliTourCreateValidation.spec.ts",
    sources: [
      "apps/web/src/features/tours/wizard/denali/validation/denaliWizardEdgeCases.spec.ts",
    ],
  },
  {
    target: "apps/web/src/features/tours/wizard/domain/mapDenaliWizardToCreateTourPayload.spec.ts",
    sources: [
      "apps/web/src/features/tours/wizard/domain/mapDenaliWizardCustomServiceLabels.spec.ts",
      "apps/web/src/features/tours/wizard/domain/mapDenaliWizardNonAttendanceDetails.spec.ts",
      "apps/web/src/features/tours/wizard/denali/validation/denaliApiParity.spec.ts",
    ],
  },
  {
    target: "apps/web/src/features/tours/wizard/fieldGroups.spec.ts",
    sources: ["apps/web/src/features/tours/wizard/filterFormPatchByActiveGroups.spec.ts"],
  },
  {
    target: "apps/web/src/features/tours/wizard/profileRules/getProfileRules.spec.ts",
    sources: [
      "apps/web/src/features/tours/wizard/profileRules/edit-required-parity.spec.ts",
      "apps/web/src/features/tours/wizard/profileRules/migratedSteps.spec.ts",
      "apps/web/src/features/tours/wizard/profileRules/parity-with-server.spec.ts",
    ],
  },
  {
    target: "apps/web/src/features/tours/wizard/profileRules/validation.spec.ts",
    sources: [
      "apps/web/src/features/tours/wizard/profileRules/submit-required-parity.spec.ts",
    ],
  },
  {
    target: "apps/web/src/features/tours/wizard/schemas/denaliCore.schema.spec.ts",
    sources: [
      "apps/web/src/features/tours/wizard/schemas/denaliCanonicalTourSchema.spec.ts",
    ],
  },
  {
    target: "apps/web/src/features/tours/clone/transformTourToDenaliWizardValues.spec.ts",
    sources: ["apps/web/src/features/tours/wizard/denali/utils/hydration.spec.ts"],
  },
  {
    target: "apps/web/src/features/tours/wizard/denali/denaliCanonicalFormAdapter.spec.ts",
    sources: [
      "apps/web/src/features/tours/wizard/denali/utils/denaliCanonicalTourModelFullState.spec.ts",
    ],
  },
  {
    target: "apps/api/src/modules/finance/ledger/persist-ledger-journal.spec.ts",
    sources: [
      "apps/api/src/modules/finance/ledger/persist-ledger-journal.currency.spec.ts",
    ],
  },
  {
    target: "apps/api/src/modules/finance/ledger/post-double-entry-journal.spec.ts",
    sources: [
      "apps/api/src/modules/finance/ledger/post-double-entry-reversal-journal.spec.ts",
    ],
  },
  {
    target: "apps/api/src/modules/tours/dto/trip-details.dto.spec.ts",
    sources: [
      "apps/api/src/modules/tours/dto/trip-details-denali-fields.dto.spec.ts",
      "apps/api/src/modules/tours/dto/trip-details-participation.dto.spec.ts",
    ],
  },
];

function gitMv(from, to) {
  const fromAbs = path.join(ROOT, from);
  const toAbs = path.join(ROOT, to);
  if (!fs.existsSync(fromAbs)) {
    console.warn(`skip missing: ${from}`);
    return;
  }
  if (fs.existsSync(toAbs) && from !== to) {
    return "collision";
  }
  fs.mkdirSync(path.dirname(toAbs), { recursive: true });
  const r = spawnSync("git", ["mv", from, to], { cwd: ROOT, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
  return "ok";
}

function extractTestBody(content) {
  const m = content.match(/^(\s*(?:test|describe|it)\s*\()/m);
  if (!m || m.index === undefined) return content;
  return content.slice(m.index);
}

function mergeIntoTarget(sources, targetRel) {
  const targetAbs = path.join(ROOT, targetRel);
  let target = fs.existsSync(targetAbs) ? fs.readFileSync(targetAbs, "utf8") : "";
  for (const srcRel of sources) {
    const srcAbs = path.join(ROOT, srcRel);
    if (!fs.existsSync(srcAbs)) {
      console.warn(`merge skip missing: ${srcRel}`);
      continue;
    }
    const src = fs.readFileSync(srcAbs, "utf8");
    const body = extractTestBody(src);
    target += `\n\n/* merged from ${path.basename(srcRel)} */\n${body}`;
    fs.unlinkSync(srcAbs);
    spawnSync("git", ["add", "-u", srcRel], { cwd: ROOT });
  }
  fs.writeFileSync(targetAbs, target);
  spawnSync("git", ["add", targetRel], { cwd: ROOT });
}

function fixImportsInMovedFiles() {
  const fixes = [
    [
      "apps/web/src/features/tours/wizard/denali/components/DenaliReviewValidationSummary.integration.test.tsx",
      [
        ['from "../DenaliCanonicalContext"', 'from "../DenaliCanonicalContext"'],
        ['from "../components/DenaliReviewValidationSummary"', 'from "./DenaliReviewValidationSummary"'],
        ['from "../DenaliWizardNavigationContext"', 'from "../DenaliWizardNavigationContext"'],
      ],
    ],
    [
      "apps/web/src/features/tours/wizard/denali/steps/DenaliPricingStep.integration.test.tsx",
      [
        ['from "../DenaliCanonicalContext"', 'from "../DenaliCanonicalContext"'],
        ['from "../steps/DenaliPricingStep"', 'from "./DenaliPricingStep"'],
      ],
    ],
    [
      "apps/web/src/features/tours/wizard/denali/DenaliWizardSyncContext.integration.test.tsx",
      [
        ['from "../DenaliCanonicalContext"', 'from "./DenaliCanonicalContext"'],
        ['from "../DenaliStepFocusBridge"', 'from "./DenaliStepFocusBridge"'],
        ['from "../DenaliWizardNavigationContext"', 'from "./DenaliWizardNavigationContext"'],
        ['from "../DenaliWizardSyncContext"', 'from "./DenaliWizardSyncContext"'],
        ['from "../hooks/useDenaliCanonicalModel"', 'from "./hooks/useDenaliCanonicalModel"'],
      ],
    ],
    [
      "apps/web/src/features/tours/wizard/denali/denaliStepConfig.spec.ts",
      [
        ['from "../../registry/denaliFieldRegistryData"', 'from "./registry/denaliFieldRegistryData"'],
        ['from "@/features/tours/wizard/denaliStepConfig"', 'from "./denaliStepConfig"'],
      ],
    ],
  ];
  for (const [rel, pairs] of fixes) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    let text = fs.readFileSync(abs, "utf8");
    for (const [from, to] of pairs) {
      text = text.split(from).join(to);
    }
    fs.writeFileSync(abs, text);
    spawnSync("git", ["add", rel], { cwd: ROOT });
  }
}

console.log("=== git mv renames ===");
const collisions = [];
for (const [from, to] of RENAMES) {
  const result = gitMv(from, to);
  if (result === "collision") collisions.push({ from, to });
}

for (const { from, to } of collisions) {
  console.log(`collision: merge ${from} -> ${to}`);
  MERGES.push({ target: to, sources: [from] });
}

console.log("=== merges ===");
for (const { sources, target } of MERGES) {
  mergeIntoTarget(sources, target);
}

fixImportsInMovedFiles();

console.log("done");
