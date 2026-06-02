import {
  canViewTourDetailChatLink,
  hasFullTourDetailAccess,
  type TourDetailAccessLevel,
  type TourDetailViewHints,
} from "@repo/types";

function cloneTour(tour: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(tour);
}

function ensureTripDetailsShell(tour: Record<string, unknown>): Record<string, unknown> {
  if (tour.details == null || typeof tour.details !== "object" || Array.isArray(tour.details)) {
    tour.details = {};
  }
  const details = tour.details as Record<string, unknown>;
  if (
    details.tripDetails == null ||
    typeof details.tripDetails !== "object" ||
    Array.isArray(details.tripDetails)
  ) {
    details.tripDetails = {};
  }
  return (details.tripDetails as Record<string, unknown>);
}

function deleteChatFields(tour: Record<string, unknown>): void {
  delete tour.chatLink;
  delete tour.chat_link;
  delete tour.communicationLink;
  delete tour.communication_link;
}

function maskLocationCoords(location: unknown): void {
  if (location == null || typeof location !== "object" || Array.isArray(location)) {
    return;
  }
  const loc = location as Record<string, unknown>;
  loc.latitude = null;
  loc.longitude = null;
}

function stripOverviewGpsPoints(overview: Record<string, unknown>): void {
  for (const key of ["startPoint", "summitPoint", "campPoint", "endPoint"]) {
    delete overview[key];
  }
}

function stripGatheringPointCoords(tripDetails: Record<string, unknown>): void {
  const logistics = tripDetails.logistics;
  if (logistics == null || typeof logistics !== "object" || Array.isArray(logistics)) {
    return;
  }
  const gathering = (logistics as Record<string, unknown>).gatheringPoints;
  if (!Array.isArray(gathering)) {
    return;
  }
  for (const row of gathering) {
    if (row == null || typeof row !== "object") {
      continue;
    }
    const station = row as Record<string, unknown>;
    if (station.location != null) {
      maskLocationCoords(station.location);
    }
  }
}

function removeGatheringPoints(tripDetails: Record<string, unknown>): void {
  const logistics = tripDetails.logistics;
  if (logistics == null || typeof logistics !== "object" || Array.isArray(logistics)) {
    return;
  }
  delete (logistics as Record<string, unknown>).gatheringPoints;
}

function stripGuestLogistics(logistics: Record<string, unknown>): void {
  delete logistics.meetingPoint;
  delete logistics.returnPoint;
  delete logistics.gatheringPoints;
  delete logistics.transportationNotes;
  delete logistics.accommodationNotes;
  delete logistics.mealNotes;
  delete logistics.leaderInsuranceNotes;
  delete logistics.fuelShareToman;
  delete logistics.privateCarMode;
  delete logistics.leaderProvidesInsurance;
  delete logistics.groupSizeMin;
  delete logistics.groupSizeMax;
  delete logistics.primaryTransportMode;
}

function stripGuestItinerary(itinerary: Record<string, unknown>): void {
  delete itinerary.segmentActivities;
  delete itinerary.dayPlans;
}

function stripGuestParticipation(tripDetails: Record<string, unknown>): void {
  const participation = tripDetails.participation;
  if (participation == null || typeof participation !== "object" || Array.isArray(participation)) {
    return;
  }
  const p = participation as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  if (Array.isArray(p.gearRequiredIds)) {
    next.gearRequiredIds = p.gearRequiredIds;
  }
  if (Array.isArray(p.gearOptionalIds)) {
    next.gearOptionalIds = p.gearOptionalIds;
  }
  tripDetails.participation = next;
}

function stripGuestPolicies(tripDetails: Record<string, unknown>): void {
  delete tripDetails.policies;
}

function applyPurchasedGpsMask(
  tripDetails: Record<string, unknown>,
  viewHints: TourDetailViewHints,
): void {
  if (viewHints.gpsUnlocked) {
    return;
  }
  const overview = tripDetails.overview;
  if (overview != null && typeof overview === "object" && !Array.isArray(overview)) {
    const o = overview as Record<string, unknown>;
    for (const key of ["startPoint", "summitPoint", "campPoint", "endPoint"]) {
      if (o[key] != null) {
        maskLocationCoords(o[key]);
      }
    }
  }
  stripGatheringPointCoords(tripDetails);
}

function redactGuest(tour: Record<string, unknown>): void {
  delete tour.formProfileSnapshot;
  delete tour.form_profile_snapshot;
  deleteChatFields(tour);

  const tripDetails = ensureTripDetailsShell(tour);

  const itinerary = tripDetails.itinerary;
  if (itinerary != null && typeof itinerary === "object" && !Array.isArray(itinerary)) {
    stripGuestItinerary(itinerary as Record<string, unknown>);
  }

  const overview = tripDetails.overview;
  if (overview != null && typeof overview === "object" && !Array.isArray(overview)) {
    stripOverviewGpsPoints(overview as Record<string, unknown>);
  }

  const logistics = tripDetails.logistics;
  if (logistics != null && typeof logistics === "object" && !Array.isArray(logistics)) {
    stripGuestLogistics(logistics as Record<string, unknown>);
  }

  removeGatheringPoints(tripDetails);
  stripGuestParticipation(tripDetails);
  stripGuestPolicies(tripDetails);
}

function redactPurchased(
  tour: Record<string, unknown>,
  viewHints: TourDetailViewHints,
): void {
  delete tour.formProfileSnapshot;
  delete tour.form_profile_snapshot;
  deleteChatFields(tour);

  const tripDetails = ensureTripDetailsShell(tour);
  applyPurchasedGpsMask(tripDetails, viewHints);
}

/**
 * Returns a redacted copy of the upstream tour for the resolved access level.
 * Catalog merges (gear/themes) should run on this result.
 */
export function buildTourDetailViewForAccess(
  tour: Record<string, unknown>,
  accessLevel: TourDetailAccessLevel,
  viewHints: TourDetailViewHints,
): Record<string, unknown> {
  const view = cloneTour(tour);

  if (hasFullTourDetailAccess(accessLevel)) {
    if (!canViewTourDetailChatLink(accessLevel)) {
      deleteChatFields(view);
    }
    return view;
  }

  if (accessLevel === "PURCHASED_USER") {
    redactPurchased(view, viewHints);
    return view;
  }

  redactGuest(view);
  return view;
}
