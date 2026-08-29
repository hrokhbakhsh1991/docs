export const DENALI_PHOTOS_TEST_IDS = {
  photos: "denali-composite-photos",
  addPhoto: "denali-composite-photos-add",
  uploadInput: "denali-composite-photos-upload",
  preview: "denali-composite-photos-preview",
  uploading: "denali-composite-photos-uploading",
  optionalEmpty: "denali-photos-optional-empty",
  daySections: "denali-photos-day-sections",
  daySection: (day: number) => `denali-photos-day-${day}`,
  dayGrid: (day: number) => `denali-photos-day-grid-${day}`,
  addPhotoToDay: (day: number) => `denali-photos-day-add-${day}`,
  coverBadge: "denali-photos-cover-badge",
} as const;

export const DENALI_PHOTO_PREVIEW_TEST_ID = "denali-composite-photos-preview";
export const DENALI_PHOTO_PREVIEW_FALLBACK_TEST_ID = "denali-composite-photos-preview-fallback";
export const DENALI_PHOTO_PREVIEW_RETRY_TEST_ID = "denali-composite-photos-preview-retry";

export const DENALI_ITINERARY_SEGMENT_DESTINATION_TEST_IDS = {
  select: "denali-itinerary-segment-destination",
} as const;

export const DENALI_ITINERARY_SEGMENT_PHOTO_TEST_IDS = {
  picker: "denali-itinerary-segment-photo-picker",
  toggle: (photoId: string) => `denali-itinerary-segment-photo-${photoId}`,
  empty: "denali-itinerary-segment-photos-empty",
} as const;
