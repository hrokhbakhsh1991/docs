# Forensic Audit: Modern Denali Create Wizard — Live UI Input Inventory

**Review date:** 2026-05-31  
**Method:** Reverse audit from operational JSX only — `apps/web/src/features/tours/denali/sections/*`, nested widgets/components, and `review` step inputs. Wizard step files under `wizard/denali/steps/` re-export these sections verbatim.  
**Excluded:** Registry rows, Layer C Settings paths, rule-set claims, and review **display-only** `ReviewRow` summaries.  
**Code changes:** None (analysis only)

---

## Executive summary

| Metric | Count |
|--------|------:|
| Wizard rail steps (staff-facing) | 7 |
| **Active input control bindings** (unique widgets staff interact with) | **58** |
| Unique underlying form/canonical property paths (array/zone patterns counted once) | 45 |
| Layer C Settings seed paths (48) with **no** matching wizard input | 4 |
| Wizard-only inputs (not in Layer C overlay allow-list) | 3 |

**Source of truth:** Step bodies in `denali/sections/` plus `DenaliReviewStep` publish control and nested widgets (`DenaliProgramContentSection`, `DenaliDailyItinerarySection`, `DenaliGatheringPointsWidget`, `DenaliLocationZonesSection`, `DenaliGearSection`, `DenaliPricingParticipantSection`, `DenaliCustomServicesField`, `DenaliPeakExperienceField`, `DenaliDatetimeField`, `DenaliApproximateReturnTimeField`, `DenaliItineraryStep`).

---

## Master inventory: Step → Label/Role → Form property path

> **Visibility:** Many controls are gated by `useDenaliStepFieldRules` / contextual rules — they render in the live wizard when classification + overlay allow, but the JSX control always exists in the step file below.

### Step 1 — `denali_basic` (اطلاعات پایه) — `DenaliBasicInfoSection.tsx`

| # | Visual control label / role | Control type | Underlying form / canonical path |
|---|----------------------------|--------------|----------------------------------|
| 1 | Tour category (دسته‌بندی) | `Select` | `basicsSelection.category` → canonical `category` / RHF `basicInfo.tourType` |
| 2 | Tour title | `Input` (text) | canonical `title` · `data-field-path="basicInfo.title"` |
| 3 | Duration (تک‌روز / چندروز) | `Select` | `basicsSelection.duration` → canonical `duration` / `basicInfo.tourType` |
| 4 | Event variant | `Select` | `basicsSelection.eventVariant` → canonical `eventVariant` |
| 5 | Destination | `DestinationCombobox` | canonical `destinationId` · `basicInfo.destinationId` |
| 6 | Peak height (ارتفاع قله) | `PersianNumberInput` | `tripDetails.overview.peakHeight` → canonical `overview.peakHeight` |
| 7 | Workspace leaders | `DestinationCombobox` (multi) | canonical `leaderUserIds` |
| 8 | Requires local guide | `Checkbox` | canonical `requiresLocalGuide` |
| 9 | Local guide name | `Input` (text) | canonical `localGuideName` · `basicInfo.localGuideName` |
| 10 | Start date | `JalaliDatePicker` | `basicInfo.startDateTime` → canonical `startDateTime` |
| 11 | Start time | `JalaliTimePicker` | `basicInfo.startDateTime` (combined ISO) |
| 12 | End date | `JalaliDatePicker` | `basicInfo.endDateTime` → canonical `endDateTime` |
| 13 | End time | `JalaliTimePicker` | `basicInfo.endDateTime` |
| 14 | Capacity max | `PersianNumberInput` | canonical `capacityMax` · `basicInfo.capacityMax` |
| 15 | Capacity min | `PersianNumberInput` | canonical `capacityMin` · `basicInfo.capacityMin` |
| 16 | Approximate return time | `JalaliTimePicker` | `basicInfo.approximateReturnTime` → canonical `approximateReturnTime` |
| 17 | Social media link / handle | `Input` (text) | canonical `socialMediaLink` |
| 18 | Requires manual admin approval | `Checkbox` | canonical `requiresManualAdminApproval` |

**Header plugin (basic step only):** `DenaliTemplateSelectorPlugin` → workspace preset banner (`DenaliTourCreationPresetBanner`) — applies preset JSON, not a canonical field editor.

---

### Step 2 — `denali_photos` (عکس‌ها) — `DenaliPhotosSection.tsx` + `DenaliProgramContentSection.tsx`

| # | Visual control label / role | Control type | Underlying form / canonical path |
|---|----------------------------|--------------|----------------------------------|
| 19 | Program themes | `Checkbox` (one per catalog theme) | canonical `program.themeIds` · RHF `programNature.themeIds` |
| 20 | Short description | `Textarea` | canonical `program.shortDescription` · `programNature.shortDescription` |
| 21 | Long description | `Textarea` | canonical `program.longDescription` · `programNature.longDescription` |
| 22 | Gallery photo upload | `Input` (file, multi) | canonical `photos` · RHF `photosData.photos` |

---

### Step 3 — `denali_program` (برنامه) — `DenaliProgramNatureSection.tsx` + widgets

| # | Visual control label / role | Control type | Underlying form / canonical path |
|---|----------------------------|--------------|----------------------------------|
| 23 | Difficulty level (1–10 slider) | `input[type=range]` | canonical `program.difficultyLevel` · `programNature.difficultyLevel` |
| 24 | Approximate hiking hours | `PersianNumberInput` | canonical `program.hikingHoursApprox` |
| 25 | Hiking go hours | `PersianNumberInput` | canonical `program.hikingGoHours` |
| 26 | Hiking return hours | `PersianNumberInput` | canonical `program.hikingReturnHours` |
| 27 | Route elevation gain | `PersianNumberInput` | `tripDetails.metrics.elevationGain` → canonical `metrics.elevationGain` (`DenaliItineraryStep.tsx`) |
| 28 | Daily itinerary — day location | `DenaliLocationPickerEditor` (search + map modal) | canonical `program.itinerary[n].location` · per-day in `DenaliDailyItinerarySection` |
| 29 | Daily itinerary — day activities | `Textarea` | canonical `program.itinerary[n].activities` |
| 30 | Daily itinerary — day photos | `FileUploadField` (file) | canonical `program.itinerary[n].photos` |

---

### Step 4 — `denali_logistics` (لجستیک و خدمات) — `DenaliLogisticsSection.tsx` + widgets

| # | Visual control label / role | Control type | Underlying form / canonical path |
|---|----------------------------|--------------|----------------------------------|
| 31 | Gathering station — time | `JalaliTimePicker` | `tripDetails.logistics.gatheringPoints[n].time` → canonical `gatheringPoints[n].time` |
| 32 | Gathering station — location | `DenaliLocationPickerEditor` | `tripDetails.logistics.gatheringPoints[n].location` → canonical `gatheringPoints[n].location` |
| 33 | Start point zone | `DenaliLocationPickerEditor` | `basicInfo.startPoint` → canonical `startPoint` |
| 34 | Summit point zone | `DenaliLocationPickerEditor` | `basicInfo.summitPoint` → canonical `summitPoint` |
| 35 | Camp point zone | `DenaliLocationPickerEditor` | `basicInfo.campPoint` → canonical `campPoint` |
| 36 | End point zone | `DenaliLocationPickerEditor` | `basicInfo.endPoint` → canonical `endPoint` |
| 37 | Required / suggested gear | Gear pill buttons (catalog toggle) | `participantRequirements.gearItems` → canonical `participants.gearItems` (`DenaliGearSection.tsx`) |
| 38 | Transport mode | `Select` | `transport.transportMode` → canonical `transport.mode` |
| 39 | Transport cost (Toman) | `PersianNumberInput` | `transport.transportCost` |
| 40 | Allow personal car | `Checkbox` | `transport.allowPersonalCar` |
| 41 | Dong / fuel share amount | `PersianNumberInput` | `transport.dongAmount` |
| 42 | Separate capacity calculation | `Checkbox` | `transport.adminCapacityApproval` |
| 43 | Custom service labels | `Input` (text, dynamic list) | `tripDetails.overview.customServiceLabels[n]` (`DenaliCustomServicesField.tsx`) |

---

### Step 5 — `denali_pricing` (هزینه) — `DenaliPricingSection.tsx` + `DenaliPricingParticipantSection.tsx`

| # | Visual control label / role | Control type | Underlying form / canonical path |
|---|----------------------------|--------------|----------------------------------|
| 44 | Requires payment | `Checkbox` | canonical `pricing.requiresPayment` · `pricingPayment.requiresPayment` |
| 45 | Base price per person | `PersianNumberInput` | canonical `pricing.basePricePerPerson` |
| 46 | Includes tour insurance | `Checkbox` | canonical `pricing.includesTourInsurance` |
| 47 | Non-attendance details | `Textarea` | `tripDetails.overview.nonAttendanceDetails` (wizard-only; `inRuleModel: false`) |
| 48 | Min required peaks (auto-approval) | `Select` | `participantRequirements.minRequiredPeaks` → canonical `participants.minRequiredPeaks` (`DenaliPeakExperienceField.tsx`) |
| 49 | Minimum age | `PersianNumberInput` | canonical `participants.minimumAge` |
| 50 | Maximum age | `PersianNumberInput` | canonical `participants.maximumAge` |
| 51 | Fitness level | `Select` | canonical `participants.fitnessLevel` |
| 52 | National ID required | `Checkbox` | canonical `participants.nationalIdRequired` |
| 53 | Sports insurance required | `Checkbox` | canonical `participants.sportsInsuranceRequired` |
| 54 | Fitness prerequisite text | `Textarea` | canonical `participants.fitnessPrerequisiteText` |

---

### Step 6 — `denali_legal` (قوانین و شرایط) — `DenaliLegalSection.tsx`

| # | Visual control label / role | Control type | Underlying form / canonical path |
|---|----------------------------|--------------|----------------------------------|
| 55 | Policies / notes | `Textarea` | canonical `policies.policiesText` |
| 56 | Cancellation deadline (hours) | `PersianNumberInput` | canonical `policies.cancellationDeadlineHours` |
| 57 | Cancellation penalty (%) | `PersianNumberInput` | canonical `policies.cancellationPenaltyPercentage` |

---

### Step 7 — `review` (بازبینی و ثبت) — `DenaliReviewStep.tsx`

| # | Visual control label / role | Control type | Underlying form / canonical path |
|---|----------------------------|--------------|----------------------------------|
| 58 | Publish status (draft / active) | `TourPublishStatusField` | `basicInfo.publishStatus` → canonical `publishStatus` |

> All other review sections are **read-only** `ReviewRow` displays — including `startPointLocationText`, which appears as summary text only with **no** editable control anywhere in the wizard steps.

---

## Drift analysis: Settings Layer C (48 paths) vs modern wizard UI

### Layer C paths with **no** staff input in the live wizard

| Settings storage path | Registry note | Wizard reality |
|----------------------|---------------|----------------|
| `startPointLocationText` | Layer C excluded (`settingsSurface: review`) but still in legacy rule model | **Display-only** on review step; never rendered as `Input`/`Textarea` in any step body |
| `pricing.paymentMode` | Ghost / implicit (`inRuleModel: false`) | Hardcoded to `offline_receipt` in adapters; pricing step shows hint text only — **no selector** |
| `transport.transportNotes` | Implicit (`inRuleModel: false`) | **No textarea** in `DenaliLogisticsSection`; hydrate/wire only |
| `transport.seatPreference` | `inRuleModel: false`, contextual train seat | **No input** in logistics step JSX |

### Deprecated / removed from Layer C (correctly absent from wizard)

| Path | Status |
|------|--------|
| `meetingPoint` | Deprecated registry row — no wizard widget |
| `gatheringPoint` (singular) | Deprecated — wizard uses `gatheringPoints[]` widget instead |
| `publishStatus` | Excluded from Layer C overlay — wizard captures on **review** step only |

### Wizard inputs **not** in Settings Layer C allow-list (48)

| Wizard control | RHF / canonical path | Why absent from Settings |
|----------------|---------------------|--------------------------|
| Non-attendance details textarea | `tripDetails.overview.nonAttendanceDetails` | Registry `inRuleModel: false` |
| Min required peaks select | `participants.minRequiredPeaks` | Registry `inRuleModel: false` |
| Custom service labels | `tripDetails.overview.customServiceLabels` | Registry `inRuleModel: false`; contextual capability gate |

### Structural path vocabulary drift (Settings JSONB vs wizard RHF)

| Settings Layer A storage path | Modern wizard RHF path | Notes |
|------------------------------|------------------------|-------|
| `category`, `duration`, `eventVariant` | `basicInfo.tourType` (composite) | Three canonical scalars → one tour-kind rail |
| `transport.mode` | `transport.transportMode` | Enum values differ (`DENALI_TRANSPORT_MODE_VALUES` vs `DENALI_CANONICAL_TRANSPORT_MODE_VALUES`) |
| `participants.*` | `participantRequirements.*` | Same data, different form slice name |
| `program.*` | `programNature.*` | Descriptions/themes on photos step; metrics on program step |
| `overview.peakHeight` | `tripDetails.overview.peakHeight` | Rule-path prefix drift |
| `metrics.elevationGain` | `tripDetails.metrics.elevationGain` | Rule-path prefix drift |
| `gatheringPoints` | `tripDetails.logistics.gatheringPoints` | Nested under tripDetails in RHF |
| `photos` | `photosData.photos` | Gallery upload slice |

### Field families in Settings template that **over-expose** legacy scalars

The Settings Phase 2/3 builder still exposes **48 flat scalar seed rows** (plus overlay matrix) keyed by Layer C storage paths. The modern wizard instead:

- **Merged** category + duration + event variant into the tour-type rail (not three independent first-class inputs on separate mental steps).
- **Dropped** free-text transport notes and train seat preference from UI entirely.
- **Fixed** payment mode off-UI (offline receipt only).
- **Moved** publish lifecycle to review (not basic info).
- **Replaced** `startPointLocationText` with geolocation zone pickers (`startPoint`…`endPoint`) + gathering point map/time widgets.

---

## Conclusion

The live Denali create wizard exposes **58 active input control bindings** across 7 rail steps, backed by **45 unique form property paths** when repeatable/array patterns are counted once. Prior Settings-template audits that treated Layer C registry paths as synonymous with staff-facing widgets overstated parity: at least **4 registry-adjacent fields** (`startPointLocationText`, `pricing.paymentMode`, `transport.transportNotes`, `transport.seatPreference`) have **no** editable modern control, while **3 wizard-only fields** never appear in the Settings overlay allow-list.

**Authoritative UI map:** this document’s master table — not `listDenaliSettingsOverlayStoragePaths()` alone.
