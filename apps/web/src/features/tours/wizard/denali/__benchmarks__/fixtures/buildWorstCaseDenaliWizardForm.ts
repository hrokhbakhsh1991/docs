import type { DenaliItineraryDayRow } from "../../denaliItinerarySync";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import {
  buildDenaliTourCreateTestValues,
  DENALI_WIZARD_TEST_DESTINATION_ID,
  DENALI_WIZARD_TEST_THEME_ID,
} from "@/features/tours/wizard/schemas/denaliCore.schema";

const MAX_ITINERARY_DAYS = 21;
const MAX_GATHERING_STATIONS = 8;
const MAX_GEAR_ITEMS = 24;
const MAX_PHOTOS = 12;

function buildMaxItinerary(): DenaliItineraryDayRow[] {
  return Array.from({ length: MAX_ITINERARY_DAYS }, (_, index) => ({
    day: index + 1,
    activities: `Day ${index + 1} activities — summit approach, acclimatization, and safety briefing with extended narrative for worst-case validation.`,
    locationText: `Camp ${index + 1}, Alborz range`,
    location: {
      addressText: `Station ${index + 1}, Tehran province`,
      latitude: 35.7 + index * 0.01,
      longitude: 51.4 + index * 0.01,
    },
    photos: [
      {
        id: `photo-day-${index + 1}`,
        url: `https://example.com/itinerary/day-${index + 1}.jpg`,
        filename: `day-${index + 1}.jpg`,
        mimeType: "image/jpeg",
        uploadStatus: "uploaded" as const,
      },
    ],
  }));
}

/**
 * Largest realistic Denali wizard payload for submit-gate / publish-readiness benchmarks.
 */
export function buildWorstCaseDenaliWizardForm(): DenaliCreateTourWizardForm {
  const base = buildDenaliTourCreateTestValues();

  return {
    ...base,
    basicInfo: {
      ...base.basicInfo,
      title: "Worst-case Denali benchmark tour — full field population",
      tourType: "mountain_multi",
      destinationId: DENALI_WIZARD_TEST_DESTINATION_ID,
      startDateTime: "2026-06-01T05:00:00.000Z",
      endDateTime: "2026-06-22T18:00:00.000Z",
      capacityMin: 4,
      capacityMax: 24,
      meetingPoint: "Tehran — Azadi square assembly",
      startPointLocationText: "Damavand south route trailhead",
      approximateReturnTime: "2026-06-22T20:00:00.000Z",
      leaderUserIds: ["leader-1", "leader-2", "leader-3"],
      requiresLocalGuide: true,
      localGuideName: "Benchmark guide",
      requiresManualAdminApproval: true,
      socialMediaLink: "https://example.com/tour",
      publishStatus: "active",
    },
    programNature: {
      ...base.programNature,
      themeIds: [DENALI_WIZARD_TEST_THEME_ID, DENALI_WIZARD_TEST_THEME_ID],
      shortDescription: "Short description for worst-case submit gate benchmark payload.",
      longDescription:
        "Long description for worst-case submit gate benchmark payload with extended program narrative.",
      difficultyLevel: 9,
      hikingHoursApprox: 10,
      hikingGoHours: 6,
      hikingReturnHours: 4,
      itinerary: buildMaxItinerary(),
    },
    transport: {
      transportMode: "bus",
      dongAmount: 250_000,
      transportCost: 1_200_000,
      transportNotes: "Charter bus with two backup vehicles for benchmark payload.",
      allowPersonalCar: true,
      adminCapacityApproval: true,
      seatPreference: "Window seats preferred for photography.",
    },
    pricingPayment: {
      requiresPayment: true,
      basePricePerPerson: 8_500_000,
      paymentMode: "offline_receipt",
      includesTourInsurance: true,
    },
    participantRequirements: {
      minimumAge: 18,
      maximumAge: 55,
      fitnessLevel: "high",
      nationalIdRequired: true,
      sportsInsuranceRequired: true,
      minRequiredPeaks: 3,
      fitnessPrerequisiteText: "Prior 4000m+ summit experience required.",
      gearItems: Array.from({ length: MAX_GEAR_ITEMS }, (_, index) => ({
        id: `gear-${index + 1}`,
        required: index % 2 === 0,
      })),
    },
    policies: {
      policiesText: "Cancellation and refund policies for benchmark worst-case payload.",
      cancellationDeadlineHours: 72,
      cancellationPenaltyPercentage: 25,
    },
    photosData: {
      photos: Array.from({ length: MAX_PHOTOS }, (_, index) => ({
        id: `cover-${index + 1}`,
        url: `https://example.com/photos/cover-${index + 1}.jpg`,
        filename: `cover-${index + 1}.jpg`,
        mimeType: "image/jpeg",
        uploadStatus: "uploaded" as const,
      })),
    },
    tripDetails: {
      logistics: {
        gatheringPoints: Array.from({ length: MAX_GATHERING_STATIONS }, (_, index) => ({
          id: `gathering-${index + 1}`,
          title: `Gathering station ${index + 1}`,
          time: `${String(6 + (index % 6)).padStart(2, "0")}:30`,
          location: {
            addressText: `Gathering address ${index + 1}, Tehran`,
            latitude: 35.68 + index * 0.02,
            longitude: 51.38 + index * 0.02,
          },
        })),
      },
      overview: {
        ...base.tripDetails.overview,
        peakHeight: 5610,
        customServiceLabels: ["porter", "cook", "medic", "photographer"],
        startPoint: {
          addressText: "Damavand trailhead — benchmark start",
          latitude: 35.9519,
          longitude: 52.109,
        },
        summitPoint: {
          addressText: "Summit zone — benchmark",
          latitude: 35.955,
          longitude: 52.1095,
        },
        campPoint: {
          addressText: "High camp — benchmark",
          latitude: 35.953,
          longitude: 52.1092,
        },
        endPoint: {
          addressText: "Return trailhead — benchmark",
          latitude: 35.951,
          longitude: 52.1085,
        },
      },
      metrics: {
        elevationGain: 2800,
        distanceKm: 42,
      },
    },
  };
}
