Tour Create Wizard README

README.tour-create-wizard

Purpose

This document defines the complete design for the new multi‑step Wizard used to create tours at route /tours/new. It documents the domain model alignment between frontend (Next.js + React Hook Form + Zod) and backend (NestJS DTO validation + PostgreSQL JSONB trip_details). The goal is to support highly flexible event types including mountaineering, trekking, nature tours, multi‑day trips, and social gatherings such as board games, book clubs, movie nights, and hybrid trips.

Key Design Goal

The system must support complex and mixed itineraries. Examples:





Two summits in one day



Mountaineering + historical site visit



Trekking + cultural exploration



Multi‑day hybrid expeditions



Indoor social gatherings (board games, books, film nights)

The data model must not assume that every event is a mountain trip.



SECTION 1 — Core Domain Model



Primary table: tour_details
Important column: trip_details (JSONB)

trip_details is the flexible container for event specific data. It includes:





overview



itinerary



participation



logistics



policies

Legacy columns such as destination_name, meeting_point, and legacy itinerary fields may exist but should gradually be normalized into trip_details.

Validation

Backend uses NestJS ValidationPipe with:





class-validator



whitelist



forbidNonWhitelisted

Unknown fields are rejected.

Contextual Gates

Some fields are only allowed when the event context requires them.
Example: maxAltitudeMeters should only be stored for mountain events.



SECTION 2 — Overview Structure



The overview section defines the identity of the event.

Example structure:

{
  "overview": {
    "title": "Climb Mount Hezar + Historical Village Visit",
    "shortDescription": "Two day mountaineering trip including summit and cultural exploration",
    "mainTheme": "mountaineering",
    "secondaryThemes": ["cultural", "nature"],
    "highlights": [
      "Summit Mount Hezar",
      "Visit historical village",
      "High altitude hiking"
    ]
  }
}


mainTheme examples:





mountaineering



trekking



nature



cultural



social



mixed

secondaryThemes allow hybrid trips.



SECTION 3 — Flexible Itinerary Model



The itinerary must support multiple activities per day.

This enables:





two peaks in one day



summit + cultural visit



transfer + hiking



social segments

Data model:

TourItineraryDay

{
  "dayIndex": number,
  "title": string,
  "dateOffset": number,
  "segments": TourItinerarySegment[]
}


TourItinerarySegment

{
  "type": "approach" | "summit" | "hike" | "transfer" | "cultural" | "rest" | "social",
  "title": string,
  "description": string,
  "location": string,
  "maxAltitudeMeters": number,
  "distanceKm": number,
  "estimatedDurationHours": number
}


Example – Two summits in one day

Day 1
segments:





summit – Peak A



summit – Peak B

Example – Mixed trip

Day 1





transfer to region



cultural site visit

Day 2





summit climb



SECTION 4 — Participation Section



Defines who can join and requirements.

Example:

{
  "participation": {
    "capacity": 20,
    "minAge": 16,
    "requiredFitnessLevel": "moderate",
    "experienceRequired": false,
    "gearRequiredIds": [3,5,8],
    "guideLanguageIds": [1,2]
  }
}


These IDs are validated against backend catalog tables.



SECTION 5 — Logistics



Logistics describe operational details.

Example:

{
  "logistics": {
    "meetingPoint": "Kerman city square",
    "transportation": "minibus",
    "accommodationType": "camp",
    "mealsIncluded": true
  }
}


For social events many fields may be empty.



SECTION 6 — Policies



Defines rules and cancellation logic.

Example:

{
  "policies": {
    "cancellationPolicy": "full_refund_48h",
    "safetyNotes": "follow guide instructions",
    "insuranceIncluded": false
  }
}




SECTION 7 — Wizard UX Flow



The new /tours/new interface becomes a multi‑step wizard.

Step 1 — Basic Info





Title



Main theme



Secondary themes



Short description

Step 2 — Capacity & Pricing





Capacity



Base price



Discount rules

Step 3 — Location & Dates





Start date



End date



Meeting point



Destination region

Step 4 — Itinerary Builder





Add days



Add activities per day



Activity type selector



Altitude/distance optional fields

Step 5 — Participation Requirements





Age



Fitness



Experience



Required gear

Step 6 — Logistics





Transport



Accommodation



Meals

Step 7 — Policies & Safety





Rules



Insurance



Cancellation

Step 8 — Review & Submit





Final summary



Validation check



Submit



SECTION 8 — Frontend Architecture



Single React Hook Form instance.

Per‑step validation using:
trigger(stepFields)

Dynamic Zod schemas depending on eventKind.

Component structure suggestion:

TourCreateWizard





Steps





StepBasicInfo



StepCapacityPricing



StepLocationDates



StepItinerary



StepParticipation



StepLogistics



StepPolicies



StepReview

Reusable component:

ItineraryBuilder

This component supports:





Add day



Add segment



Reorder segments



SECTION 9 — Backend Safe Extension Points



When adding new fields:





Always update DTO first



Update class-validator rules



Extend trip_details JSON schema



Add mapping in service layer



Only then update frontend



SECTION 10 — Future Extensions



Possible new sections:





riskAssessment



route



emergencyContacts



weatherStrategy

Example:

"riskAssessment": {
  "objectiveHazards": ["rockfall","weather"],
  "mitigation": "helmet required"
}




SECTION 11 — Important Design Rule



The system must allow:





multiple peaks in one day



mixed cultural + nature itineraries



non‑mountain social events



multi‑day expeditions

Therefore the itinerary must always support:

DAY → MULTIPLE SEGMENTS

Never assume a single activity per day.



SECTION 12 — Migration Note



Legacy fields may still exist but new development must prefer trip_details JSON.

Older itinerary text fields can be mapped to a single segment of type "generic" during migration.



END OF DOCUMENT