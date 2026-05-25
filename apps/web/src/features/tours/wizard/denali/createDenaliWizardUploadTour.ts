import type { TourFormProfile } from "@repo/types";

import { createTour, type CreateTourDto } from "@/lib/services/tours.service";

const STAGING_TITLE = "پیش‌نویس — در حال تکمیل ویزارد";

/**
 * Creates a draft tour shell so gallery uploads can use `POST /api/tours/:tourId/photos`
 * before the wizard submit payload is built.
 */
export async function createDenaliWizardUploadTour(_input: {
  workspaceFormProfile: TourFormProfile;
}): Promise<string> {
  const dto: CreateTourDto = {
    title: STAGING_TITLE,
    capacity: 1,
    lifecycle_status: "Draft",
    transportModes: [],
    price: 0,
    requiresPayment: false,
    tripDetails: {
      overview: {
        shortIntro: STAGING_TITLE,
      },
      logistics: {
        departureDate: new Date().toISOString().slice(0, 10),
        departureMeetingTime: "08:00",
        groupSizeMax: 1,
      },
    },
  };

  const created = await createTour(dto, {
    idempotencyKey:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? `denali-wizard-upload-${crypto.randomUUID()}`
        : `denali-wizard-upload-${Date.now()}`,
  });

  const id = created.id?.trim();
  if (!id) {
    throw new Error("createDenaliWizardUploadTour: API response missing tour id");
  }
  return id;
}
