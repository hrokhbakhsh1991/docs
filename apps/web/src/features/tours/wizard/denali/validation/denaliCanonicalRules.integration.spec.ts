import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/tours/wizard/fieldGroups", async () => {
  const actual = await vi.importActual<typeof import("@/features/tours/wizard/fieldGroups")>(
    "@/features/tours/wizard/fieldGroups",
  );
  return {
    ...actual,
    inactiveTourCreateRootKeysForProfile: () => [],
  };
});

import { submitValidDenaliWizardDefaults } from "./denaliSubmitTestHelpers";
import { getDenaliWizardSubmitIssues } from "./denaliWizardFormZod";

function hasIssue(issues: ReturnType<typeof getDenaliWizardSubmitIssues>, path: string): boolean {
  return issues.some((issue) => issue.path.map(String).join(".") === path);
}

describe("Denali canonical business rules integration", () => {
  it("fails when multi-day endDateTime is before startDateTime", () => {
    const form = submitValidDenaliWizardDefaults();
    form.basicInfo.tourType = "mountain_multi";
    form.basicInfo.startDateTime = "2026-08-11T10:00:00.000Z";
    form.basicInfo.endDateTime = "2026-08-11T09:00:00.000Z";

    const issues = getDenaliWizardSubmitIssues(form);
    expect(hasIssue(issues, "basicInfo.endDateTime")).toBe(true);
  });

  it("fails when capacityMin is greater than capacityMax", () => {
    const form = submitValidDenaliWizardDefaults();
    form.basicInfo.capacityMin = 30;
    form.basicInfo.capacityMax = 20;

    const issues = getDenaliWizardSubmitIssues(form);
    expect(hasIssue(issues, "basicInfo.capacityMin")).toBe(true);
  });

  it("fails when minimumAge is greater than maximumAge", () => {
    const form = submitValidDenaliWizardDefaults();
    form.participantRequirements.minimumAge = 50;
    form.participantRequirements.maximumAge = 20;

    const issues = getDenaliWizardSubmitIssues(form);
    expect(hasIssue(issues, "participantRequirements.maximumAge")).toBe(true);
  });

  it("fails when multi-day itinerary day has empty activities", () => {
    const form = submitValidDenaliWizardDefaults();
    form.basicInfo.tourType = "mountain_multi";
    form.programNature.itinerary = [
      {
        day: 1,
        locationText: "Day 1 camp",
        activities: "",
        photos: [],
      },
    ];

    const issues = getDenaliWizardSubmitIssues(form);
    expect(hasIssue(issues, "programNature.itinerary.0.activities")).toBe(true);
  });
});
