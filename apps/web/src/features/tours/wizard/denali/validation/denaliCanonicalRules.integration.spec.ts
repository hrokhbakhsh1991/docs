import { describe, expect, it } from "vitest";
import { denaliCanonicalTourSchema } from "@/features/tours/wizard/schemas/denaliCanonicalTourSchema.unified";

describe("canonical denali invariants", () => {
  it("multi-day endDateTime must be after startDateTime", () => {
    const canonical = buildValidCanonical();
    const result = denaliCanonicalTourSchema.safeParse({
      ...canonical,
      duration: "multi",
      startDateTime: "2026-06-03T18:00:00.000Z",
      endDateTime: "2026-06-03T17:00:00.000Z",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.join(".") === "endDateTime")).toBe(true);
  });

  it("capacityMin cannot exceed capacityMax", () => {
    const canonical = buildValidCanonical();
    const result = denaliCanonicalTourSchema.safeParse({
      ...canonical,
      capacityMin: 25,
      capacityMax: 20,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.join(".") === "capacityMin")).toBe(true);
  });

  it("minimumAge cannot exceed maximumAge", () => {
    const canonical = buildValidCanonical();
    const result = denaliCanonicalTourSchema.safeParse({
      ...canonical,
      participants: {
        ...canonical.participants,
        minimumAge: 45,
        maximumAge: 30,
      },
    });
    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some((i) => i.path.join(".") === "participants.maximumAge"),
    ).toBe(true);
  });

  it("multi-day itinerary rows require activities", () => {
    const canonical = buildValidCanonical();
    const result = denaliCanonicalTourSchema.safeParse({
      ...canonical,
      duration: "multi",
      endDateTime: "2026-06-04T08:00:00.000Z",
      program: {
        ...canonical.program,
        itinerary: [{ day: 1, activities: "   " }],
      },
    });
    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some((i) => i.path.join(".") === "program.itinerary.0.activities"),
    ).toBe(true);
  });
});

function buildValidCanonical() {
  return {
    category: "mountain",
    duration: "single",
    title: "تور تست یک‌روزه",
    destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    startDateTime: "2026-06-01T08:00:00.000Z",
    endDateTime: undefined,
    capacityMax: 20,
    capacityMin: 10,
    meetingPoint: "میدان آزادی",
    startPointLocationText: "تهران",
    gatheringPoints: [],
    leaderUserIds: ["b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33"],
    requiresLocalGuide: false,
    requiresManualAdminApproval: false,
    publishStatus: "draft",
    overview: {
      peakHeight: 5600,
    },
    metrics: {},
    program: {
      themeIds: ["c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44"],
      shortDescription: "توضیح کوتاه",
      longDescription: "توضیح کامل برنامه",
      difficultyLevel: 5,
      hikingHoursApprox: 7,
      itinerary: [{ day: 1, activities: "صعود و بازگشت" }],
    },
    transport: {
      mode: "none",
    },
    pricing: {
      requiresPayment: true,
      paymentMode: "offline_receipt",
      basePricePerPerson: 500000,
      includesTourInsurance: true,
    },
    participants: {
      minimumAge: 18,
      maximumAge: 60,
      fitnessLevel: "medium",
    },
    policies: {},
    photos: [],
  } as const;
}
