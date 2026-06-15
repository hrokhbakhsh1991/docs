import { PlatformWizardEngine } from "@app-tour/platform-core";
import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali";
import { filterDenaliCanonicalValidationResult } from "../../../packages/workspaces/denali/src/wizard/denali-wizard-validation.ts";
import { prepareDenaliSubmitArtifact } from "../../../packages/workspaces/denali/src/acl/migrateDenaliCanonical.ts";
import { createCanonicalDocument } from "@app-tour/workspace-sdk";

const plugin = getDenaliWorkspacePlugin();
const { tourList, tourClone, publicCatalog, wizardHost, ...pluginForEngine } = plugin;
const engine = PlatformWizardEngine.create(pluginForEngine as typeof plugin);
engine.init();

const data = prepareDenaliSubmitArtifact({
  basicInfo: {
    tourType: "mountain_multi",
    title: "Test",
    destinationId: "00000000-0000-4000-8000-000000000701",
    startDateTime: "2026-07-01T08:00:00.000Z",
    endDateTime: "2026-07-03T18:00:00.000Z",
    capacityMax: 12,
    leaderUserIds: [],
  },
  tripDetails: { overview: { peakHeight: 5610 } },
  programNature: {
    shortDescription: "x",
    difficultyLevel: 6,
    hikingHoursApprox: 8,
    themeIds: [],
    guideLanguageIds: [],
    itinerary: [
      { dayNumber: 1, title: "d1", segments: [{ title: "s1" }] },
      { dayNumber: 2, title: "d2", segments: [{ title: "s2" }] },
    ],
  },
  transport: { transportMode: "none" },
  participantRequirements: { minimumAge: 18, fitnessLevel: "medium" },
  pricingPayment: { requiresPayment: false },
  photosData: { photos: [] },
});

const document = createCanonicalDocument({
  schemaVersion: 1,
  roots: [...plugin.wizard.roots],
  data,
});

const raw = engine.validateCanonical(document, {
  tenantId: "00000000-0000-4000-8000-000000000003",
  dimensions: { category: "mountain", duration: "multi_day" },
});
const filtered = filterDenaliCanonicalValidationResult(raw, document.data as Record<string, unknown>);
console.log("raw ok:", raw.ok, "violations:", raw.violations.length);
for (const v of raw.violations.slice(0, 5)) {
  console.log(" ", v.fieldId, v.code);
}
console.log("filtered ok:", filtered.ok, "violations:", filtered.violations.length);
for (const v of filtered.violations) {
  console.log(" remaining", v.fieldId, v.code, v.message);
}
