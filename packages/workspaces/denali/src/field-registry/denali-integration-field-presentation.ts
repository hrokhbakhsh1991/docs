type DenaliFieldPresentation = {
  readonly adminLabel: string;
  readonly group: string;
  readonly adminDescription?: string;
};

/** Admin integration UI labels keyed by registry field id (not canonical path). */
const DENALI_FIELD_PRESENTATION_BY_ID: Readonly<Record<string, DenaliFieldPresentation>> =
  Object.freeze({
    title: { adminLabel: "Tour Title", group: "General" },
    "denali.destination": { adminLabel: "Tour Destination", group: "Location" },
    "denali.datetime": { adminLabel: "Start Date", group: "Schedule" },
    "denali.datetime-end": { adminLabel: "End Date", group: "Schedule" },
    "denali.approximate-return-time": {
      adminLabel: "Approximate Return Time",
      group: "Schedule",
    },
    meetingPoint: { adminLabel: "Meeting Point", group: "Location" },
    startPointLocationText: { adminLabel: "Start Point", group: "Location" },
    "denali.location-zones": {
      adminLabel: "Location Zones",
      group: "Location",
      adminDescription: "Start, summit, camp and end location zones.",
    },
    capacityMax: { adminLabel: "Maximum Capacity", group: "General" },
    capacityMin: { adminLabel: "Minimum Capacity", group: "General" },
    "denali.pricing-participants": { adminLabel: "Participant Pricing", group: "Pricing" },
    "denali.pricing-payment": { adminLabel: "Payment Requirements", group: "Pricing" },
    "denali.photos": { adminLabel: "Tour Photos", group: "Media" },
    "denali.social-media-link": {
      adminLabel: "Group / Social Link",
      group: "General",
    },
  });

function inferDenaliPresentationGroup(canonicalPath: string, tags: readonly string[]): string {
  if (tags.includes("destination")) {
    return "Location";
  }
  const lower = canonicalPath.toLowerCase();
  if (lower.startsWith("pricing.") || lower.includes(".pricing.")) {
    return "Pricing";
  }
  if (lower.includes("photo")) {
    return "Media";
  }
  if (
    lower.includes("date") ||
    lower.includes("time") ||
    canonicalPath === "duration" ||
    canonicalPath === "approximateReturnTime"
  ) {
    return "Schedule";
  }
  if (
    lower.includes("destination") ||
    lower.includes("meeting") ||
    lower.includes("location") ||
    lower.includes("startpoint") ||
    lower.includes("gathering")
  ) {
    return "Location";
  }
  return "General";
}

export function resolveDenaliRegistryPresentation(input: {
  readonly id: string;
  readonly canonicalPath: string;
  readonly tags?: readonly string[];
}): DenaliFieldPresentation | null {
  const explicit = DENALI_FIELD_PRESENTATION_BY_ID[input.id];
  if (explicit != null) {
    return explicit;
  }

  const tags = input.tags ?? [];
  const group = inferDenaliPresentationGroup(input.canonicalPath, tags);
  return { adminLabel: "", group };
}

export function denaliRegistryPresentationFields(input: {
  readonly id: string;
  readonly canonicalPath: string;
  readonly tags?: readonly string[];
}): {
  readonly adminLabel?: string;
  readonly group?: string;
  readonly adminDescription?: string;
} {
  const resolved = resolveDenaliRegistryPresentation(input);
  if (resolved == null) {
    return {};
  }
  if (resolved.adminLabel.trim().length > 0) {
    return {
      adminLabel: resolved.adminLabel,
      group: resolved.group,
      ...(resolved.adminDescription == null ? {} : { adminDescription: resolved.adminDescription }),
    };
  }
  return { group: resolved.group };
}
