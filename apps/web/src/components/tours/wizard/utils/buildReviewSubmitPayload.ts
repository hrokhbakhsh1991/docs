import type { TourCreateFormValues } from "../schemas/tourCreateSchema";

/**
 * Pure function that builds the final payload sent to the backend.
 * No side‑effects – suitable for unit testing.
 */
export function buildReviewSubmitPayload(data: {
  autoAcceptRegistrations?: boolean;
  overview?: TourCreateFormValues["overview"];
  pricing?: TourCreateFormValues["pricing"];
  schedule?: TourCreateFormValues["schedule"];
  location?: TourCreateFormValues["location"];
  itinerary?: TourCreateFormValues["itinerary"];
  participation?: TourCreateFormValues["participation"];
  logistics?: TourCreateFormValues["logistics"];
  policies?: TourCreateFormValues["policies"];
}) {
  // The shape mirrors the server contract; we simply copy fields.
  // Any transformation (e.g., date formatting) should be done here.
  return {
    autoAcceptRegistrations: data.autoAcceptRegistrations,
    overview: data.overview,
    pricing: data.pricing,
    schedule: data.schedule,
    location: data.location,
    itinerary: data.itinerary,
    participation: data.participation,
    logistics: data.logistics,
    policies: data.policies,
  };
}
