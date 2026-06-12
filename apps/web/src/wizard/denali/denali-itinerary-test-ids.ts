export const DENALI_ITINERARY_TEST_IDS = {
  itinerary: "denali-composite-itinerary",
  day: (dayNumber: number) => `denali-composite-itinerary-day-${dayNumber}`,
  segment: (dayNumber: number, segmentId: string) =>
    `denali-composite-itinerary-day-${dayNumber}-segment-${segmentId}`,
  addSegment: (dayNumber: number) => `denali-composite-itinerary-day-${dayNumber}-add-segment`,
} as const;
