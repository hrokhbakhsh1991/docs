/**
 * Simulates gallery-upload staging shell path (ensureUploadTourId → createDenaliWizardUploadTour)
 * and prints the createTour DTO without calling the API.
 *
 * Usage: pnpm --filter web exec tsx scripts/capture-upload-tour-create-payload.ts
 */
import { buildDenaliTourCreateDefaultValues } from "../src/features/tours/wizard/schemas/denaliTourCreateFormModel";
import { buildDenaliWizardUploadTourPayload } from "../src/features/tours/wizard/denali/createDenaliWizardUploadTour";
import { denaliRuleSet } from "../src/features/tours/wizard/denali/rules/denaliRuleModel";

const form = buildDenaliTourCreateDefaultValues();
form.basicInfo.tourType = "mountain_day";
form.photosData.photos = [
  {
    id: "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33",
    url: "blob:http://localhost:3000/failed-payload-diagnostic",
    filename: "gallery-upload-probe.jpg",
    size: 245678,
    mimeType: "image/jpeg",
    uploadedAt: "2026-06-01T12:00:00.000Z",
    uploadStatus: "pending",
  },
];

const dto = buildDenaliWizardUploadTourPayload({
  form,
  ruleSet: denaliRuleSet,
  workspaceFormProfile: "denali_pilot",
});

console.log("[FAILED PAYLOAD DIAGNOSTIC] createTour payload:", JSON.stringify(dto, null, 2));
