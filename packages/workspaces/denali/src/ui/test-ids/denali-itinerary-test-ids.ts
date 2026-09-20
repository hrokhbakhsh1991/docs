export const DENALI_ITINERARY_TEST_IDS = {
  itinerary: "denali-composite-itinerary",
  nav: "denali-composite-itinerary-nav",
  dayNav: (dayNumber: number) => `denali-composite-itinerary-day-nav-${dayNumber}`,
  dayNavStatus: (dayNumber: number) => `denali-composite-itinerary-day-nav-${dayNumber}-status`,
  prevDay: "denali-composite-itinerary-prev-day",
  nextDay: "denali-composite-itinerary-next-day",
  day: (dayNumber: number) => `denali-composite-itinerary-day-${dayNumber}`,
  segment: (dayNumber: number, segmentId: string) =>
    `denali-composite-itinerary-day-${dayNumber}-segment-${segmentId}`,
  addSegment: (dayNumber: number) => `denali-composite-itinerary-day-${dayNumber}-add-segment`,
} as const;
