Denali Create Tour Wizard — UX Field Inventory
Shell: DenaliCreateTourWizard.tsx → steps from denaliStepConfig.ts (6 steps).
Required/Optional: From denaliRuleSet.generated.ts + useDenaliStepFieldRules (varies by category × duration × transport mode × capabilities). Default labels use tours.denali keys where noted.

Step 1 — اطلاعات پایه (denali_basic)
Field Label / Name	Component Path	Input Type	Required / Optional
عنوان تور (title / basicInfo.title)
denali/steps/DenaliBasicInfoStep.tsx
text
Required
دسته تور (category → basicInfo.tourType)
DenaliBasicInfoStep.tsx
select
Required
مدت تور (duration → basicInfo.tourType)
DenaliBasicInfoStep.tsx
select
Required
زیرنوع رویداد (eventVariant → basicInfo.tourType)
DenaliBasicInfoStep.tsx
select
Optional (visible when category = event)
مقصد (destinationId)
DenaliBasicInfoStep.tsx + components/tours/wizard/steps/DestinationCombobox.tsx
combobox (search)
Required when visible
ارتفاع قله (tripDetails.overview.peakHeight)
DenaliBasicInfoStep.tsx
number (Persian)
Required (mountain); hidden (nature/desert/event per rules)
سرپرست‌های workspace (leaderUserIds)
DenaliBasicInfoStep.tsx
multi-select combobox
Optional
نیاز به راهنمای محلی (requiresLocalGuide)
DenaliBasicInfoStep.tsx
checkbox
Optional
نام راهنمای محلی (localGuideName)
DenaliBasicInfoStep.tsx
text
Optional (shown when requiresLocalGuide = true)
تاریخ و ساعت شروع (startDateTime)
denali/DenaliDatetimeField.tsx
date + time (Jalali)
Required
تاریخ و ساعت پایان (endDateTime)
DenaliDatetimeField.tsx
date + time (Jalali)
Required (multi-day); hidden (single-day)
ظرفیت حداکثر (capacityMax)
DenaliBasicInfoStep.tsx
number
Required when visible
ظرفیت حداقل (capacityMin)
DenaliBasicInfoStep.tsx
number
Optional
ساعت تقریبی بازگشت (approximateReturnTime)
denali/DenaliApproximateReturnTimeField.tsx
time (Jalali)
Optional
لینک شبکه اجتماعی (socialMediaLink)
DenaliBasicInfoStep.tsx
text
Optional
نیاز به تأیید دستی ادمین (requiresManualAdminApproval)
DenaliBasicInfoStep.tsx
checkbox
Optional
Step count (static inputs): 16 (11–14 typically visible depending on tour kind).

Step 2 — برنامه (denali_program)
Field Label / Name	Component Path	Input Type	Required / Optional
تم‌های تور (programNature.themeIds / program.themeIds)
denali/steps/DenaliProgramNatureStep.tsx
checkbox group (catalog)
Optional
توضیح کوتاه (program.shortDescription)
DenaliProgramNatureStep.tsx
textarea
Required
توضیح بلند (program.longDescription)
DenaliProgramNatureStep.tsx
textarea
Optional
سطح سختی (program.difficultyLevel)
DenaliProgramNatureStep.tsx
range (1–10)
Required when outdoor block visible
ساعات پیاده‌روی تقریبی (program.hikingHoursApprox)
DenaliProgramNatureStep.tsx
number
Required when outdoor block visible
ساعات رفت (program.hikingGoHours)
DenaliProgramNatureStep.tsx
number
Optional
ساعات برگشت (program.hikingReturnHours)
DenaliProgramNatureStep.tsx
number
Optional
ارتفاع صعود مسیر (tripDetails.metrics.elevationGain)
denali/steps/DenaliItineraryStep.tsx
number
Optional (hidden for nature/desert/event cells)
Per day (× D days): مکان روز (program.itinerary[].location)
denali/steps/DenaliDailyItinerarySection.tsx + components/DenaliItineraryDayLocationField.tsx + DenaliLocationPickerEditor.tsx
location (search + map)
Optional per day; section hidden unless multi-day
Per day: فعالیت‌های روز (program.itinerary[].activities)
DenaliDailyItinerarySection.tsx
textarea
Required per day when itinerary visible (multi-day mountain/nature/desert)
Per day: عکس‌های روز (program.itinerary[].photos)
DenaliDailyItinerarySection.tsx + components/DenaliItineraryDayPhotos.tsx
file array
Optional per day
Step count: 8 fixed + 3 × D (D = computed day count from startDateTime / endDateTime / tourType).

Step 3 — لجستیک و خدمات (denali_logistics)
Field Label / Name	Component Path	Input Type	Required / Optional
Per gathering station (× S): ساعت حضور (tripDetails.logistics.gatheringPoints[].time)
denali/components/DenaliGatheringPointsWidget.tsx
time (Jalali)
Optional (publish may require ≥1 station)
Per station: نام/آدرس ایستگاه (…location / title)
DenaliGatheringPointsWidget.tsx + DenaliLocationPickerEditor.tsx
location (search + map)
Optional
نقطه شروع (basicInfo.startPoint)
denali/components/DenaliLocationZoneField.tsx
location
Optional
نقطه اوج (basicInfo.summitPoint)
DenaliLocationZoneField.tsx
location
Optional
نقطه کمپ (basicInfo.campPoint)
DenaliLocationZoneField.tsx
location
Optional
نقطه پایان (basicInfo.endPoint)
DenaliLocationZoneField.tsx
location
Optional
تجهیزات (participantRequirements.gearItems)
denali/steps/DenaliGearSection.tsx
multi-select pills (required/optional toggle)
Optional
نوع حمل‌ونقل (transport.transportMode)
denali/steps/DenaliLogisticsStep.tsx
select
Required
هزینه حمل (transport.transportCost)
DenaliLogisticsStep.tsx
number
Optional (visible for organized transport modes)
امکان خودرو شخصی (transport.allowPersonalCar)
DenaliLogisticsStep.tsx
checkbox
Optional (visible for modes with personal-car option)
مبلغ دنگ (transport.dongAmount)
DenaliLogisticsStep.tsx
number
Optional (visible when personal car allowed)
ظرفیت جداگانه ادمین (transport.adminCapacityApproval)
DenaliLogisticsStep.tsx
checkbox
Optional (visible with personal-car flow)
سرویس‌های سفارشی (tripDetails.overview.customServiceLabels)
denali/components/DenaliCustomServicesField.tsx + DenaliCustomServicesEditor.tsx
string array (add/remove)
Optional (workspace capability canDefineCustomServices)
Step count: 11 fixed (4 zones + gear + up to 4 transport + custom services) + 2 × S gathering stations (S ≥ 1 when widget shown; hidden for some event kinds).

Step 4 — هزینه (denali_pricing)
Field Label / Name	Component Path	Input Type	Required / Optional
نیاز به پرداخت (pricing.requiresPayment)
denali/steps/DenaliPricingStep.tsx
checkbox
Optional
قیمت پایه هر نفر (pricing.basePricePerPerson)
DenaliPricingStep.tsx
number
Optional (visible when requiresPayment = true)
شامل بیمه تور (pricing.includesTourInsurance)
DenaliPricingStep.tsx
checkbox
Optional
جزئیات عدم حضور (tripDetails.overview.nonAttendanceDetails)
DenaliPricingStep.tsx
textarea
Optional (visible after tourType selected)
حداقل قله‌های صعودشده (participants.minRequiredPeaks)
denali/components/DenaliPeakExperienceField.tsx
select
Optional
حداقل سن (participants.minimumAge)
denali/steps/DenaliPricingParticipantSection.tsx
number
Required when mountain participant block visible
حداکثر سن (participants.maximumAge)
DenaliPricingParticipantSection.tsx
number
Optional
سطح آمادگی (participants.fitnessLevel)
DenaliPricingParticipantSection.tsx
select
Required when mountain block visible
کد ملی الزامی (participants.nationalIdRequired)
DenaliPricingParticipantSection.tsx
checkbox
Optional
بیمه ورزشی (participantRequirements.sportsInsuranceRequired)
DenaliPricingParticipantSection.tsx
checkbox
Optional
پیش‌نیاز آمادگی (participants.fitnessPrerequisiteText)
DenaliPricingParticipantSection.tsx
textarea
Optional
یادداشت سیاست‌ها (policies.policiesText)
DenaliPricingParticipantSection.tsx
textarea
Optional
مهلت لغو (ساعت) (policies.cancellationDeadlineHours)
DenaliPricingParticipantSection.tsx
number
Optional
جریمه لغو (%) (policies.cancellationPenaltyPercentage)
DenaliPricingParticipantSection.tsx
number
Optional
Note: pricing.paymentMode is required in rules but not rendered as a separate control (offline-only; implied).

Step count: 14 (6–11 visible for nature/event when participant block hidden).

Step 5 — عکس‌ها (denali_photos)
Field Label / Name	Component Path	Input Type	Required / Optional
گالری تور (photosData.photos)
denali/steps/DenaliPhotosStep.tsx
file upload (multi, max 10) + preview/remove
Optional (rule); may be required on publish per validation
Step count: 1 (array field; each upload adds items).

Step 6 — بازبینی و ثبت (review)
Field Label / Name	Component Path	Input Type	Required / Optional
وضعیت انتشار (basicInfo.publishStatus)
denali/steps/DenaliReviewStep.tsx + components/tours/TourPublishStatusField.tsx
segmented control (draft / active)
Required (defaults draft; active gated by publish readiness)
Display-only on review (not counted as inputs): summary rows in DenaliReviewStep.tsx, DenaliReviewParticipantsDisplay.tsx, DenaliReviewValidationSummary.tsx.

Step count: 1 editable field.

Count summary
Wizard step	Static field controls	Dynamic add-ons
اطلاعات پایه (denali_basic)
16
—
برنامه (denali_program)
8
+3 × D (itinerary days)
لجستیک (denali_logistics)
11
+2 × S (gathering stations)
هزینه (denali_pricing)
14
—
عکس‌ها (denali_photos)
1
+N photo items
بازبینی (review)
1
—
Scenario	Total field controls
Minimum (e.g. nature single-day, no gathering, no itinerary)
~42
Typical Denali mountain single-day (S=1, no itinerary)
~53
Maximum (mountain multi-day, S=2, D=3)
~62
Grand total (wizard inputs, all steps): 51 static + 3D + 2S dynamic controls (≈ 42–62 visible depending on tour kind and workspace capabilities).

Hidden / conditional logic (brief)
Trigger	Affected fields
Category = event
eventVariant shown; outdoor program block (difficulty, hiking hours) hidden for event single-day.
Category × duration (rule matrix)
endDateTime; peakHeight; elevationGain; daily program.itinerary; participant block on pricing (mountain vs nature/event).
Duration options
Disabled duration options in category select via isDurationAllowed.
requiresLocalGuide
localGuideName shown.
requiresPayment
pricing.basePricePerPerson shown.
Transport mode
transportCost, allowPersonalCar, dongAmount, adminCapacityApproval shown/hidden per @repo/types/denali transport helpers (patchDenaliTransportForMode).
allowPersonalCar
dongAmount, adminCapacityApproval visibility.
Multi-day tour kind
Daily itinerary section (location, activities, photos per day); endDateTime on basic step.
Workspace capability
customServiceLabels only if canDefineCustomServices.
basicInfo.tourType set
nonAttendanceDetails on pricing step.
Destination selected
May auto-fill peakHeight from destination altitude.
Publish = active
Blocked until getDenaliWizardPublishReadinessIssues passes; gathering stations may be required for publish (UI hint in widget).
Review step
Almost all fields read-only mirror; only publishStatus is editable.
Registry-only paths not rendered in create UI: startPointLocationText (review display only), transport.transportNotes, explicit pricing.paymentMode control.

