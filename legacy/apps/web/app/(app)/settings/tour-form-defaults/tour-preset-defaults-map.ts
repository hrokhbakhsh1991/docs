/** Maps admin-friendly form fields ↔ `TourCreateFormValues`-shaped `defaults` JSON stored on presets. */

export type TourPresetSimpleFields = {
  policies: {
    cancellationPolicy: string;
    refundPolicy: string;
    attendanceRules: string;
    lateArrivalPolicy: string;
    noShowPolicy: string;
    confirmationPolicy: string;
    capacityPolicy: string;
    weatherPolicy: string;
    safetyNotes: string;
    riskDisclaimer: string;
    safetyPolicy: string;
    reservationRules: string;
  };
  participation: {
    sportsInsuranceRequired: boolean;
    registrationNationalIdRequired: boolean;
    requiredExperienceLevel: string;
    requiredFitnessLevel: string;
    genderRestriction: string;
    minimumAge: string;
    maximumAge: string;
    minParticipants: string;
    technicalSkillRequired: string;
    medicalRestrictions: string;
    requirements: string;
    skillsRequiredLines: string;
    documentsRequiredLines: string;
    suitableForLines: string;
    notSuitableForLines: string;
    gearRequiredIds: string[];
    gearOptionalIds: string[];
  };
  logistics: {
    primaryTransportMode: string;
    fuelShareToman: string;
    leaderProvidesInsurance: boolean;
    leaderInsuranceNotes: string;
    includedServices: string;
    excludedServices: string;
    meetingPointDetails: string;
    transportationDetails: string;
    transportationNotes: string;
    accommodationDetails: string;
    accommodationNotes: string;
    mealPlan: string;
    mealNotes: string;
    supportServicesLines: string;
    optionalServicesLines: string;
  };
  overview: {
    tourType: string;
    mainTourThemeId: string;
    shortDescription: string;
    longDescription: string;
    highlightsLines: string;
    communicationLink: string;
  };
  schedule: {
    departureMeetingTime: string;
    returnMeetingTime: string;
  };
  location: {
    meetingPoint: string;
    returnPoint: string;
    displayLocation: string;
  };
  autoAcceptRegistrations: boolean;
};

export function emptyTourPresetSimpleFields(): TourPresetSimpleFields {
  const emptyPolicy = "";
  return {
    policies: {
      cancellationPolicy: emptyPolicy,
      refundPolicy: emptyPolicy,
      attendanceRules: emptyPolicy,
      lateArrivalPolicy: emptyPolicy,
      noShowPolicy: emptyPolicy,
      confirmationPolicy: emptyPolicy,
      capacityPolicy: emptyPolicy,
      weatherPolicy: emptyPolicy,
      safetyNotes: emptyPolicy,
      riskDisclaimer: emptyPolicy,
      safetyPolicy: emptyPolicy,
      reservationRules: emptyPolicy,
    },
    participation: {
      sportsInsuranceRequired: false,
      registrationNationalIdRequired: false,
      requiredExperienceLevel: "",
      requiredFitnessLevel: "",
      genderRestriction: "",
      minimumAge: "",
      maximumAge: "",
      minParticipants: "",
      technicalSkillRequired: "",
      medicalRestrictions: "",
      requirements: "",
      skillsRequiredLines: "",
      documentsRequiredLines: "",
      suitableForLines: "",
      notSuitableForLines: "",
      gearRequiredIds: [],
      gearOptionalIds: [],
    },
    logistics: {
      primaryTransportMode: "",
      fuelShareToman: "",
      leaderProvidesInsurance: false,
      leaderInsuranceNotes: "",
      includedServices: "",
      excludedServices: "",
      meetingPointDetails: "",
      transportationDetails: "",
      transportationNotes: "",
      accommodationDetails: "",
      accommodationNotes: "",
      mealPlan: "",
      mealNotes: "",
      supportServicesLines: "",
      optionalServicesLines: "",
    },
    overview: {
      tourType: "",
      mainTourThemeId: "",
      shortDescription: "",
      longDescription: "",
      highlightsLines: "",
      communicationLink: "",
    },
    schedule: {
      departureMeetingTime: "",
      returnMeetingTime: "",
    },
    location: {
      meetingPoint: "",
      returnPoint: "",
      displayLocation: "",
    },
    autoAcceptRegistrations: true,
  };
}

function trimStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function linesToArray(raw: string): string[] | undefined {
  const rows = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return rows.length > 0 ? rows : undefined;
}

function arrayToLines(arr: unknown): string {
  if (!Array.isArray(arr)) return "";
  return arr.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean).join("\n");
}

function pickPolicies(src: Record<string, unknown>): TourPresetSimpleFields["policies"] {
  const empty = emptyTourPresetSimpleFields().policies;
  const keys = Object.keys(empty) as (keyof typeof empty)[];
  const out = { ...empty };
  for (const k of keys) {
    out[k] = trimStr(src[k]);
  }
  return out;
}

function uuidStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function parseOptionalInt(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) && Number.isInteger(n) && n >= 0 ? n : undefined;
}

export function defaultsRecordToSimpleFields(defaults: Record<string, unknown>): TourPresetSimpleFields {
  const base = emptyTourPresetSimpleFields();
  const policiesRaw = defaults.policies;
  if (policiesRaw && typeof policiesRaw === "object" && !Array.isArray(policiesRaw)) {
    base.policies = pickPolicies(policiesRaw as Record<string, unknown>);
  }

  const part = defaults.participation;
  if (part && typeof part === "object" && !Array.isArray(part)) {
    const p = part as Record<string, unknown>;
    base.participation.sportsInsuranceRequired = Boolean(p.sportsInsuranceRequired);
    base.participation.registrationNationalIdRequired = Boolean(p.registrationNationalIdRequired);
    base.participation.requiredExperienceLevel = trimStr(p.requiredExperienceLevel);
    base.participation.requiredFitnessLevel = trimStr(p.requiredFitnessLevel);
    base.participation.genderRestriction = trimStr(p.genderRestriction);
    base.participation.minimumAge =
      p.minimumAge != null && typeof p.minimumAge === "number" ? String(p.minimumAge) : trimStr(p.minimumAge);
    base.participation.maximumAge =
      p.maximumAge != null && typeof p.maximumAge === "number" ? String(p.maximumAge) : trimStr(p.maximumAge);
    base.participation.minParticipants =
      p.minParticipants != null && typeof p.minParticipants === "number"
        ? String(p.minParticipants)
        : trimStr(p.minParticipants);
    base.participation.technicalSkillRequired = trimStr(p.technicalSkillRequired);
    base.participation.medicalRestrictions = trimStr(p.medicalRestrictions);
    base.participation.requirements = trimStr(p.requirements);
    base.participation.skillsRequiredLines = arrayToLines(p.skillsRequired);
    base.participation.documentsRequiredLines = arrayToLines(p.documentsRequired);
    base.participation.suitableForLines = arrayToLines(p.suitableFor);
    base.participation.notSuitableForLines = arrayToLines(p.notSuitableFor);
    base.participation.gearRequiredIds = uuidStringArray(p.gearRequiredIds);
    base.participation.gearOptionalIds = uuidStringArray(p.gearOptionalIds);
  }

  const log = defaults.logistics;
  if (log && typeof log === "object" && !Array.isArray(log)) {
    const l = log as Record<string, unknown>;
    base.logistics.primaryTransportMode = trimStr(l.primaryTransportMode);
    base.logistics.fuelShareToman =
      l.fuelShareToman != null && typeof l.fuelShareToman === "number"
        ? String(l.fuelShareToman)
        : trimStr(l.fuelShareToman);
    base.logistics.leaderProvidesInsurance = Boolean(l.leaderProvidesInsurance);
    base.logistics.leaderInsuranceNotes = trimStr(l.leaderInsuranceNotes);
    base.logistics.includedServices = trimStr(l.includedServices);
    base.logistics.excludedServices = trimStr(l.excludedServices);
    base.logistics.meetingPointDetails = trimStr(l.meetingPointDetails);
    base.logistics.transportationDetails = trimStr(l.transportationDetails);
    base.logistics.transportationNotes = trimStr(l.transportationNotes);
    base.logistics.accommodationDetails = trimStr(l.accommodationDetails);
    base.logistics.accommodationNotes = trimStr(l.accommodationNotes);
    base.logistics.mealPlan = trimStr(l.mealPlan);
    base.logistics.mealNotes = trimStr(l.mealNotes);
    base.logistics.supportServicesLines = arrayToLines(l.supportServices);
    base.logistics.optionalServicesLines = arrayToLines(l.optionalServices);
  }

  const ov = defaults.overview;
  if (ov && typeof ov === "object" && !Array.isArray(ov)) {
    const o = ov as Record<string, unknown>;
    base.overview.tourType = trimStr(o.tourType);
    base.overview.mainTourThemeId = trimStr(o.mainTourThemeId);
    base.overview.shortDescription = trimStr(o.shortDescription);
    base.overview.longDescription = trimStr(o.longDescription);
    base.overview.highlightsLines = arrayToLines(o.highlights);
    base.overview.communicationLink = trimStr(o.communicationLink);
  }

  const sch = defaults.schedule;
  if (sch && typeof sch === "object" && !Array.isArray(sch)) {
    const s = sch as Record<string, unknown>;
    base.schedule.departureMeetingTime = trimStr(s.departureMeetingTime);
    base.schedule.returnMeetingTime = trimStr(s.returnMeetingTime);
  }

  const loc = defaults.location;
  if (loc && typeof loc === "object" && !Array.isArray(loc)) {
    const li = loc as Record<string, unknown>;
    base.location.meetingPoint = trimStr(li.meetingPoint);
    base.location.returnPoint = trimStr(li.returnPoint);
    base.location.displayLocation = trimStr(li.displayLocation);
  }

  if (typeof defaults.autoAcceptRegistrations === "boolean") {
    base.autoAcceptRegistrations = defaults.autoAcceptRegistrations;
  }

  return base;
}

const PRIMARY_MODES = ["plane", "train", "bus", "midibus", "private_car"] as const;

export function simpleFieldsToDefaultsPayload(fields: TourPresetSimpleFields): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  const policies: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields.policies)) {
    const t = v.trim();
    if (t) policies[k] = t;
  }
  if (Object.keys(policies).length > 0) {
    out.policies = policies;
  }

  const participation: Record<string, unknown> = {};
  if (fields.participation.sportsInsuranceRequired) {
    participation.sportsInsuranceRequired = true;
  }
  if (fields.participation.registrationNationalIdRequired) {
    participation.registrationNationalIdRequired = true;
  }
  const exp = fields.participation.requiredExperienceLevel.trim();
  if (exp) participation.requiredExperienceLevel = exp;
  const fit = fields.participation.requiredFitnessLevel.trim();
  if (fit) participation.requiredFitnessLevel = fit;
  const gen = fields.participation.genderRestriction.trim();
  if (gen) participation.genderRestriction = gen;
  const minA = parseOptionalInt(fields.participation.minimumAge);
  if (minA !== undefined) participation.minimumAge = minA;
  const maxA = parseOptionalInt(fields.participation.maximumAge);
  if (maxA !== undefined) participation.maximumAge = maxA;
  const minP = parseOptionalInt(fields.participation.minParticipants);
  if (minP !== undefined) participation.minParticipants = minP;
  const tech = fields.participation.technicalSkillRequired.trim();
  if (tech) participation.technicalSkillRequired = tech;
  const med = fields.participation.medicalRestrictions.trim();
  if (med) participation.medicalRestrictions = med;
  const req = fields.participation.requirements.trim();
  if (req) participation.requirements = req;
  const skills = linesToArray(fields.participation.skillsRequiredLines);
  if (skills) participation.skillsRequired = skills;
  const docs = linesToArray(fields.participation.documentsRequiredLines);
  if (docs) participation.documentsRequired = docs;
  const suit = linesToArray(fields.participation.suitableForLines);
  if (suit) participation.suitableFor = suit;
  const nsuit = linesToArray(fields.participation.notSuitableForLines);
  if (nsuit) participation.notSuitableFor = nsuit;
  const gearReq = fields.participation.gearRequiredIds.filter((id) => id.trim().length > 0);
  if (gearReq.length > 0) participation.gearRequiredIds = gearReq;
  const gearOpt = fields.participation.gearOptionalIds.filter((id) => id.trim().length > 0);
  if (gearOpt.length > 0) participation.gearOptionalIds = gearOpt;
  if (Object.keys(participation).length > 0) {
    out.participation = participation;
  }

  const logistics: Record<string, unknown> = {};
  const mode = fields.logistics.primaryTransportMode.trim();
  if (mode && (PRIMARY_MODES as readonly string[]).includes(mode)) {
    logistics.primaryTransportMode = mode;
  }
  const fuel = parseOptionalInt(fields.logistics.fuelShareToman);
  if (fuel !== undefined) logistics.fuelShareToman = fuel;
  if (fields.logistics.leaderProvidesInsurance) {
    logistics.leaderProvidesInsurance = true;
  }
  const lin = fields.logistics.leaderInsuranceNotes.trim();
  if (lin) logistics.leaderInsuranceNotes = lin;
  const inc = fields.logistics.includedServices.trim();
  if (inc) logistics.includedServices = inc;
  const exc = fields.logistics.excludedServices.trim();
  if (exc) logistics.excludedServices = exc;
  const mpd = fields.logistics.meetingPointDetails.trim();
  if (mpd) logistics.meetingPointDetails = mpd;
  const td = fields.logistics.transportationDetails.trim();
  if (td) logistics.transportationDetails = td;
  const tn = fields.logistics.transportationNotes.trim();
  if (tn) logistics.transportationNotes = tn;
  const ad = fields.logistics.accommodationDetails.trim();
  if (ad) logistics.accommodationDetails = ad;
  const an = fields.logistics.accommodationNotes.trim();
  if (an) logistics.accommodationNotes = an;
  const mp = fields.logistics.mealPlan.trim();
  if (mp) logistics.mealPlan = mp;
  const mn = fields.logistics.mealNotes.trim();
  if (mn) logistics.mealNotes = mn;
  const sup = linesToArray(fields.logistics.supportServicesLines);
  if (sup) logistics.supportServices = sup;
  const opt = linesToArray(fields.logistics.optionalServicesLines);
  if (opt) logistics.optionalServices = opt;
  if (Object.keys(logistics).length > 0) {
    out.logistics = logistics;
  }

  const overview: Record<string, unknown> = {};
  const tourType = fields.overview.tourType.trim();
  if (tourType) overview.tourType = tourType;
  const mtid = fields.overview.mainTourThemeId.trim();
  if (mtid) overview.mainTourThemeId = mtid;
  const sd = fields.overview.shortDescription.trim();
  if (sd) overview.shortDescription = sd;
  const ld = fields.overview.longDescription.trim();
  if (ld) overview.longDescription = ld;
  const hl = linesToArray(fields.overview.highlightsLines);
  if (hl) overview.highlights = hl;
  const cl = fields.overview.communicationLink.trim();
  if (cl) overview.communicationLink = cl;
  if (Object.keys(overview).length > 0) {
    out.overview = overview;
  }

  const schedule: Record<string, string> = {};
  const dep = fields.schedule.departureMeetingTime.trim();
  if (dep) schedule.departureMeetingTime = dep;
  const ret = fields.schedule.returnMeetingTime.trim();
  if (ret) schedule.returnMeetingTime = ret;
  if (Object.keys(schedule).length > 0) {
    out.schedule = schedule;
  }

  const location: Record<string, string> = {};
  const meet = fields.location.meetingPoint.trim();
  if (meet) location.meetingPoint = meet;
  const retp = fields.location.returnPoint.trim();
  if (retp) location.returnPoint = retp;
  const disp = fields.location.displayLocation.trim();
  if (disp) location.displayLocation = disp;
  if (Object.keys(location).length > 0) {
    out.location = location;
  }

  if (!fields.autoAcceptRegistrations) {
    out.autoAcceptRegistrations = false;
  }

  return out;
}
