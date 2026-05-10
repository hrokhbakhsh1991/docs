
این فایل شامل مجموعه پرامپت‌های مرحله‌به‌مرحله برای توسعه یا ریفکتور کامل صفحه ایجاد تور (`/tours/new`) به شکل Wizard است.

> هدف:  
> - پیاده‌سازی یک Wizard چندمرحله‌ای برای ساخت `trip_details`  
> - پشتیبانی از سناریوهای پیچیده (دو قله در یک روز، تور ترکیبی کوهنوردی + فرهنگی + اجتماعی، دورهمی‌ها، …)  
> - استفاده از Next.js + React Hook Form + Zod  
> - سازگاری با NestJS backend و مدل `trip_details` (با ساختار جدید `itinerary` و بخش‌های `overview`, `participation`, `logistics`, `policies`, …)

> نحوه استفاده از این فایل:
> - در هر مرحله، پرامپت آن مرحله را در GPT/Copilot/Cursor اجرا کن.
> - خروجی را در repo اعمال کن.
> - اگر تغییری لازم بود، در همان مرحله اصلاح کن و بعد به مرحله بعد برو.

---

## SECTION 0 – Context & Constraints (برای همه مراحل)

**PROMPT 0 – Provide full context**

> You are assisting in refactoring and implementing a complete multi-step wizard for creating tours at route `/tours/new`.
>
> Tech stack:
> - Next.js (App Router or Pages Router – infer from codebase)
> - React, TypeScript
> - React Hook Form (RHF)
> - Zod for validation
> - Backend: NestJS, REST API
>
> Domain model:
> - We have a backend `trip_details` model with sections: `overview`, `itinerary`, `participation`, `logistics`, `policies`, and optional future sections like `riskAssessment`, `route`, `emergency`.
> - `eventKind` is derived from `tourType` / `tripStyles`.
> - We want a flexible `itinerary` that supports:
>   - multi-day trips
>   - multiple activities per day (segments)
>   - mixed types of activities (e.g. mountaineering + cultural visit + social gathering)
>
> Itinerary target structure (proposed):
>
```ts
> type TourItinerarySegmentType =
>   | 'approach'
>   | 'summit'
>   | 'hike'
>   | 'trek'
>   | 'transfer'
>   | 'cultural'
>   | 'historical'
>   | 'social'
>   | 'rest'
>   | 'other';
>
> type TourItinerarySegment = {
>   id?: string;
>   type: TourItinerarySegmentType;
>   title: string;
>   description?: string;
>   location?: string;
>   maxAltitudeMeters?: number;
>   distanceKm?: number;
>   estimatedDurationHours?: number;
>   startTime?: string; // HH:mm
>   endTime?: string;   // HH:mm
> };
>
> type TourItineraryDay = {
>   dayIndex: number;
>   title?: string;
>   dateOffset?: number; // 0-based offset from start date
>   description?: string;
>   segments: TourItinerarySegment[];
> };
>
> type TourItinerary = {
>   days: TourItineraryDay[];
> };
> 
Overview target structure (simplified):


> type TourOverview = {
>   title: string;
>   slug?: string;
>   mainTheme: 'mountaineering' | 'trekking' | 'cultural' | 'social' | 'mixed';
>   secondaryThemes?: string[];
>   tourType?: string;
>   tripStyles?: string[];
>   shortDescription: string;
>   longDescription?: string;
>   highlights?: string[];
>   locationSummary?: string;
>   // ...other fields already defined in README.tour-create-wizard.md
> };
> 
We already have a detailed document README.tour-create-wizard.md that describes:

current backend trip_details structure
current frontend form
target wizard steps (8-step flow)
mapping between frontend fields and backend model
considerations for backward compatibility
General UX plan for the wizard (can be adjusted):

Basic Info (overview)
Capacity & Pricing
Location & Dates
Itinerary (multi-day, multi-segment)
Participation & Requirements
Services & Logistics
Policies & Safety
Review & Submit
Constraints:

Keep all changes compatible with the backend API (NestJS).
Use React Hook Form + Zod for each wizard step, with a shared form context.
Keep the wizard state centralised (single RHF form over all steps).
Ensure we can support complex cases:
two summits in one day
combination of social / cultural / mountaineering activities
multi-day, mixed-theme trips (e.g. mountaineering + historical visits).
Your job:

In the following steps, I’ll ask you to:
analyse existing code,
propose refactors and new components,
generate precise TypeScript/React code,
provide migration / compatibility notes.
Always:

Show complete interfaces/types when they are changed.
Show full React component code when new components are introduced.
Explain briefly how to integrate with existing code (imports, file paths, etc.).
Confirm that you understood the context and are ready for step 1. Don’t start coding yet, just summarise your understanding and what you’ll focus on.

SECTION 1 – Analyse existing implementation
PROMPT 1 – Analyse current /tours/new page and related forms

I want you to analyse the current implementation of the tour creation page and related forms.

Locate the current implementation:
/tours/new page or equivalent route
any global form components or hooks used for tour creation
any Zod schemas related to trip_details or tour creation
Summarise:
current form structure (single-page vs multi-step)
how validation is currently handled (Zod schemas, custom validation, etc.)
how the payload is built and sent to the backend (API route, service function)
Identify:
places where the current form maps to the backend trip_details
where itinerary is currently defined and how it’s structured in the frontend
Output:
a short, structured summary:
FormStructure
Validation
PayloadMapping
ItineraryHandling
KeyFiles (list of file paths)
Please show file paths and any relevant type/interface names, but do not rewrite code yet. I only want analysis.

SECTION 2 – Wizard shell & layout
PROMPT 2 – Create Wizard shell

Now we want to refactor the tour creation into a multi-step wizard.

Tasks:

Propose the file structure for the wizard components. Example:
app/tours/new/page.tsx (or similar)
components/tours/wizard/TourCreateWizard.tsx
components/tours/wizard/steps/BasicInfoStep.tsx
components/tours/wizard/steps/CapacityPricingStep.tsx
components/tours/wizard/steps/LocationDatesStep.tsx
components/tours/wizard/steps/ItineraryStep.tsx
components/tours/wizard/steps/ParticipationStep.tsx
components/tours/wizard/steps/LogisticsStep.tsx
components/tours/wizard/steps/PoliciesStep.tsx
components/tours/wizard/steps/ReviewSubmitStep.tsx
Implement a first version of TourCreateWizard.tsx that:
uses React Hook Form with a single form context for all steps
manages current step index
renders different step components based on current step
has Next / Previous navigation
Provide:
TypeScript code for TourCreateWizard.tsx
any shared types it needs (but keep them minimal; detailed domain types will be refined later)
Assumptions:

Use functional components with TypeScript.
Use React Hook Form’s FormProvider to share form context across steps.
Don’t connect to the backend yet; just prepare a onSubmit handler stub.
Output:

The complete code for:
TourCreateWizard.tsx
A short explanation of how to integrate it into /tours/new page.
SECTION 3 – Global form schema (Zod + RHF integration)
PROMPT 3 – Define Zod schema for the entire wizard

We now want to define the global Zod schema for the wizard, which will drive React Hook Form.

Tasks:

Define a Zod schema tourCreateSchema that covers all wizard steps:
overview/basic info (title, mainTheme, secondaryThemes, tourType, tripStyles, shortDescription, etc.)
capacity & pricing
location & dates
itinerary (with the flexible days and segments structure from the context)
participation & requirements
logistics
policies & safety
Pay special attention to:
itinerary:
days: { dayIndex: number; title?: string; description?: string; segments: Segment[] }[]
segments: { type, title, description?, ... }[]
overview:
mainTheme
secondaryThemes (optional array)
tourType, tripStyles (if needed)
Ensure:
the schema is compatible with the backend trip_details expectations
we can later transform this form data into the backend payload with minimal mapping
Then:
show how to integrate this Zod schema with React Hook Form in TourCreateWizard.tsx
using zodResolver
Output:

A new file schemas/tourCreateSchema.ts (or similar) with:
tourCreateSchema
TourCreateFormValues TypeScript type inferred from the schema
The updated TourCreateWizard.tsx showing:
integration of the resolver
use of TourCreateFormValues as the form type.
SECTION 4 – Step 1: Basic Info (Overview)
PROMPT 4 – Implement Basic Info step

Implement BasicInfoStep.tsx to handle the overview part of the wizard.

Requirements:

Fields (can be adjusted):
overview.title (required)
overview.shortDescription (required)
overview.longDescription (optional)
overview.mainTheme (enum: ‘mountaineering’ | ‘trekking’ | ‘cultural’ | ‘social’ | ‘mixed’)
overview.secondaryThemes (optional multi-select)
optional: overview.tourType, overview.tripStyles (if used as UI-level or backend-level enums)
Use React Hook Form’s useFormContext.
Display validation errors based on Zod schema.
Tasks:

Implement BasicInfoStep.tsx:
full TypeScript/React component
form fields mapped to tourCreateSchema
Show how to register these fields:
use register, Controller, or any custom inputs we use in the codebase
Make sure:
the step component is integrated properly into TourCreateWizard.tsx
the wizard step will block Next if required fields are missing (we can handle this by validating the whole form but conceptually focus on Zod-level constraints).
Output:

Complete BasicInfoStep.tsx code.
Any needed type adjustments in tourCreateSchema for overview.
SECTION 5 – Step 2: Capacity & Pricing
PROMPT 5 – Implement Capacity & Pricing step

Implement CapacityPricingStep.tsx.

Fields (example, adjust to match existing backend model and README mapping):

capacity:
participation.maxParticipants
participation.minParticipants?
pricing:
pricing.basePrice
pricing.currency
pricing.discountRules? (if applicable)
Tasks:

Update tourCreateSchema to include participation and pricing parts.
Implement CapacityPricingStep.tsx:
using useFormContext
mapping to Zod schema fields
Ensure:
it’s integrated in TourCreateWizard.tsx
Output:

Updated Zod schema snippet.
Full CapacityPricingStep.tsx.
SECTION 6 – Step 3: Location & Dates
PROMPT 6 – Implement Location & Dates step

Implement LocationDatesStep.tsx.

Fields (to align with backend and README):

Start/end dates:
schedule.startDate
schedule.endDate
optionally schedule.timezone
Base location:
location.country
location.region
location.city
optional location.meetingPoint
Tasks:

Extend tourCreateSchema with schedule and location sections (if not already defined).
Implement LocationDatesStep.tsx:
mapping fields to schema
using any date-picker components used in the project (if known; otherwise propose simple input types).
Output:

Updated schema.
Full LocationDatesStep.tsx.
SECTION 7 – Step 4: Itinerary (multi-day, multi-segment)
PROMPT 7 – Implement Itinerary step with days + segments

This is the critical step: implementing ItineraryStep.tsx for multi-day, multi-segment itineraries.

Goals:

Support complex itineraries, including:
multiple segments per day
different segment types: summit, trek, cultural, social, transfer, etc.
scenario: two peaks in one day (two summit segments in the same day)
scenario: mixed mountaineering + cultural in different days
Provide a UX where:
user can:
add/remove days
add/remove segments inside a day
each segment has:
type
title
optional description
optional location
optional maxAltitudeMeters, distanceKm, estimatedDurationHours
optional startTime, endTime
Tasks:

Confirm/adjust the Zod structure for itinerary:

itinerary.days[].segments[]
Implement ItineraryStep.tsx with:

use of useFieldArray from React Hook Form for:
days array
segments array per day (nested useFieldArray)
use of Controller or register for each segment field
Example UX:

A list of days:
“Day 1”, “Day 2”, …
each day block:
title (optional)
description (optional)
[Add segment] button
for each segment:
select: type
input: title
textarea: description
optional fields: altitude, distance, etc.
Buttons:
[Add day]
[Remove day]
Ensure:

the resulting form value matches the itinerary schema we defined.
we can represent scenarios like:
two summits in one day:
Day 1:
Segment 1: type = ‘summit’, title = ‘Peak A’
Segment 2: type = ‘summit’, title = ‘Peak B’
mountaineering + historical:
Day 2:
Segment 1: type = ‘summit’
Segment 2: type = ‘cultural’
social events (games, book-club, movie night):
Segment: type = ‘social’, title = ‘Board games night’
Output:

Updated itinerary part of tourCreateSchema (if needed).
Full ItineraryStep.tsx code, including:
useFieldArray usage
nested arrays handling
Any helper components (e.g. ItineraryDayCard, ItinerarySegmentForm) if you decide to extract them.
SECTION 8 – Step 5: Participation & Requirements
PROMPT 8 – Implement Participation step

Implement ParticipationStep.tsx focusing on participation & requirements.

Fields might include:

participation.requiredExperienceLevel
participation.requiredFitnessLevel
participation.ageLimit
participation.equipmentRequirements (list or text)
any other participation-related fields from the README mapping.
Tasks:

Extend tourCreateSchema.participation as needed.
Implement ParticipationStep.tsx with appropriate inputs and validation.
Ensure consistency between:
heavy/technical tours (e.g. high-altitude mountaineering)
light/social tours (e.g. board games, book club) – i.e. avoid forcing irrelevant fields.
Output:

Updated schema.
Full ParticipationStep.tsx.
SECTION 9 – Step 6: Services & Logistics
PROMPT 9 – Implement Logistics step

Implement LogisticsStep.tsx focusing on services & logistics.

Fields example:

logistics.includedServices (e.g. transport, accommodation, meals)
logistics.excludedServices
logistics.meetingPointDetails
logistics.transportationDetails
logistics.accommodationDetails
Tasks:

Extend the logistics part of tourCreateSchema.
Implement LogisticsStep.tsx.
Output:

Schema updates.
Full LogisticsStep.tsx.
SECTION 10 – Step 7: Policies & Safety
PROMPT 10 – Implement Policies & Safety step

Implement PoliciesStep.tsx focusing on policies & safety.

Fields example:

policies.cancellationPolicy
policies.refundPolicy
policies.safetyNotes
policies.riskDisclaimer
optional: riskAssessment (future extension placeholder)
Tasks:

Extend policies in tourCreateSchema.
Implement PoliciesStep.tsx.
Output:

Schema updates.
Full PoliciesStep.tsx.
SECTION 11 – Step 8: Review & Submit
PROMPT 11 – Implement Review & Submit step

Implement ReviewSubmitStep.tsx.

Goals:

Show a read-only summary of all wizard data (overview, capacity, dates, itinerary, participation, logistics, policies).
Allow user to:
go back to previous steps to edit
submit the final form
Tasks:

Implement ReviewSubmitStep.tsx:
Access all form values via useFormContext + watch.
Display a structured summary:
Basic Info
Capacity & Pricing
Location & Dates
Itinerary (days & segments)
Participation
Logistics
Policies
In TourCreateWizard.tsx:
wire up the final handleSubmit:
gather form values
transform them if necessary into backend trip_details shape
call an API function (e.g. createTour) – for now, stub it with a placeholder or an inferred API hook if available.
Output:

ReviewSubmitStep.tsx code.
Updated TourCreateWizard.tsx with final onSubmit handler.
A mapping example from TourCreateFormValues to backend payload.
SECTION 12 – Backend payload mapping & compatibility
PROMPT 12 – Define backend payload mapping

We now need a clear mapping from the wizard form values (TourCreateFormValues) to the backend payload expected by NestJS for creating a tour (trip_details or the full tour DTO).

Tasks:

Define a function:
mapFormValuesToBackendPayload(formValues: TourCreateFormValues): BackendTourCreateDto
Implement:
mapping for:
overview → relevant backend fields
itinerary → backend trip_details.itinerary structure
participation
logistics
policies
pricing and other top-level properties
Ensure:
backward compatibility:
if old backend expects a simpler itinerary, describe how to:
flatten the segments if necessary
or keep them as is if backend supports the new structure
Output:
The full implementation of this mapping function in a file like:
lib/mappers/mapTourCreateFormToDto.ts
Notes/comments inside the code explaining assumptions and compatibility decisions.
Output:

TypeScript code for the mapping function.
Example usage in TourCreateWizard.tsx in the submit handler.
SECTION 13 – Final refactor, cleanup & TODOs
PROMPT 13 – Final refactor checklist

We’ve implemented the wizard steps and mapping.

Now:

Identify any remaining TODOs:
socialLinks handling (if present)
legacy fields in old form that are not yet mapped
optional sections like riskAssessment, route, emergency
Provide:
a short checklist of remaining items
suggested incremental steps to address them later (without blocking current release)
Double-check:
that all wizard steps use a consistent form structure and Zod schema
that all fields from the old form are either:
mapped
deprecated (with explicit note)
Output:

A bullet-point checklist for further improvements.
Any small adjustments to keep the code coherent.
