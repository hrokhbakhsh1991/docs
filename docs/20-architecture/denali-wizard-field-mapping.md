# Denali 6-tab wizard — field mapping (پیوست E¹)

مرجع محصول: [`map.md`](../../map.md) · اجرا: [`map-phase.md`](../../map-phase.md) فاز ۱–۸

## اصول

- UI از `DenaliCreateTourWizardForm` (۶ تب) استفاده می‌کند.
- Wire/API همان `CreateTourDto` + `tripDetails` JSONB موجود است.
- `tripDetails.overview.denaliTourKind` slug اصلی Denali را نگه می‌دارد (W0.3).

## نگاشت `tourType` Denali → API

| `denaliTourKind` | `tours.tourType` | `isMultiDay` |
|------------------|------------------|--------------|
| `mountain_day` | `mountain` | false |
| `mountain_multi` | `mountain` | true |
| `nature_day` | `nature` | false |
| `nature_multi` | `nature` | true |
| `desert_day` | `desert` | false |
| `desert_multi` | `desert` | true |
| `event_reading` | `cultural` | false |
| `event_cinema` | `cultural` | false |

## تب ۱ — `basicInfo`

| فیلد Denali | Persistence |
|-------------|-------------|
| `title` | `tours.title` |
| `tourType` | `tripDetails.overview.denaliTourKind` + `tours.tourType` (جدول بالا) |
| `destinationId` | `tours.destination_id` |
| `startDateTime` | `tripDetails.logistics.departureDate` + `departureMeetingTime` (split ISO) |
| `endDateTime` | `tripDetails.logistics.returnDate` + `returnMeetingTime` |
| `capacityMin` | `tripDetails.logistics.groupSizeMin` |
| `capacityMax` | `tours.total_capacity` + `logistics.groupSizeMax` |
| `meetingPoint` | `tripDetails.logistics.meetingPoint` (+ legacy `tour_details.meeting_point` اگر ست شود) |

## تب ۲ — `programNature`

| فیلد Denali | Persistence |
|-------------|-------------|
| `mainTourThemeId` | `tripDetails.overview.tourThemeIds[0]` |
| `secondaryTourThemeIds` | `tripDetails.overview.tourThemeIds[1..]` |
| `shortDescription` | `tripDetails.overview.shortIntro` |
| `longDescription` | `tours.description` |
| `difficultyType` / `difficultyLevel` | mapper → `overview.difficultyLevel` (1–10) یا حذف برای `none` |
| `hikingHoursApprox` | `itinerary.programNotes` یا فیلد آینده |
| `altitudeGainApprox` | `overview.elevationGainMeters` |
| `itineraryOutline` | `tripDetails.itinerary.outline` |

## تب ۳ — `transport`

| فیلد Denali | Persistence |
|-------------|-------------|
| `primaryTransportMode` | `logistics.primaryTransportMode` + `transportModes[]` |
| `primaryTransportDescription` | `logistics.transportationNotes` |
| `privateCarAllowed` | `supplementalPrivateCar` + منطق `private_car` در modes |
| `privateCarMode` | `logistics.privateCarMode` (JSONB جدید، فاز ۵) |
| `dongAmountPerSeat` | `logistics.fuelShareToman` |
| `transportNotes` | append به `transportationNotes` |

### Transport mode mapping

| Denali UI | API `primaryTransportMode` / `transportModes` |
|-----------|-----------------------------------------------|
| `bus` | `bus` |
| `minibus` | `bus` |
| `van` | `bus` |
| `train` | `train` |
| `private_car` | `private_car` |
| `none` | `transportModes: []` |

## تب ۴ — `pricingPayment`

| فیلد Denali | Persistence |
|-------------|-------------|
| `requiresPayment` | `cost_context.requiresPayment` |
| `basePricePerPerson` | `cost_context.totalCost` / `listPriceMinor` |
| `includesTransportInPrice` | `cost_context` metadata (optional key) |
| `paymentMode` | ثابت `offline_receipt` → `cost_context.paymentMode` وقتی `requiresPayment` |

## تب ۵ — `participantRequirements`

| فیلد Denali | Persistence |
|-------------|-------------|
| `minimumAge` / `maximumAge` | `participation.minimumAge` / `maximumAge` |
| `fitnessLevel` | `participation.fitnessLevel` (map low→easy, medium→moderate, high→hard) |
| `experienceLevel` | `participation.experienceLevel` |
| `requiredGearIds` / `optionalGearIds` | `gearRequiredIds` / `gearOptionalIds` |
| `sportsInsuranceRequired` | `participation.sportsInsuranceRequired` |
| `medicalNotes` | `participation.medicalRestrictions` |
| `technicalSkillNotes` | `participation.technicalSkillRequired` |

## تب ۶ — `policies`

| فیلد Denali | Persistence |
|-------------|-------------|
| `cancellationPolicy` | `policies.cancellationPolicy` |
| `refundPolicy` | `policies.refundPolicy` |
| `attendanceRules` | `policies.attendanceRules` |
| `safetyPolicy` | `policies.safetyPolicy` |
| `weatherPolicy` | `policies.weatherPolicy` |

## Rollout و سازگاری legacy

→ [`denali-wizard-rollout.md`](./denali-wizard-rollout.md)
