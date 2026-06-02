/** Layer C ghost paths — never rendered in the Settings template builder (no modern wizard input). */
export const DENALI_TEMPLATE_BUILDER_GHOST_PATHS = [
  "publishStatus",
  "startPointLocationText",
  "pricing.paymentMode",
  "transport.transportNotes",
  "transport.seatPreference",
  /** Not a Layer A top-level key — classification uses category + duration only. */
  "eventVariant",
] as const;

const GHOST_PATH_SET = new Set<string>(DENALI_TEMPLATE_BUILDER_GHOST_PATHS);

/** Active Layer C paths for the left configuration panel (modern UI map, ghosts excluded). */
export function resolveModernTemplateBuilderFieldPaths(
  layerCPaths: readonly string[],
): readonly string[] {
  return layerCPaths.filter((path) => !GHOST_PATH_SET.has(path));
}
export type TourWizardTemplateSectionGroup = {
  readonly id: string;
  readonly titleKey:
    | "tourWizardTemplateSectionBasic"
    | "tourWizardTemplateSectionLogistics"
    | "tourWizardTemplateSectionTransport"
    | "tourWizardTemplateSectionPricing"
    | "tourWizardTemplateSectionMarketing";
  readonly paths: readonly string[];
};

export const TOUR_WIZARD_TEMPLATE_SECTION_GROUPS: readonly TourWizardTemplateSectionGroup[] = [
  {
    id: "basic",
    titleKey: "tourWizardTemplateSectionBasic",
    paths: [
      "title",
      "category",
      "duration",
      "destinationId",
      "leaderUserIds",
      "overview.peakHeight",
      "startDateTime",
      "endDateTime",
      "capacityMax",
      "capacityMin",
      "approximateReturnTime",
      "requiresLocalGuide",
      "localGuideName",
      "requiresManualAdminApproval",
      "socialMediaLink",
    ],
  },
  {
    id: "logistics",
    titleKey: "tourWizardTemplateSectionLogistics",
    paths: [
      "startPoint",
      "summitPoint",
      "campPoint",
      "endPoint",
      "gatheringPoints",
      "participants.gearItems",
      "customServiceLabels",
    ],
  },
  {
    id: "transport",
    titleKey: "tourWizardTemplateSectionTransport",
    paths: [
      "transport.mode",
      "transport.transportCost",
      "transport.allowPersonalCar",
      "transport.dongAmount",
      "transport.adminCapacityApproval",
    ],
  },
  {
    id: "pricing",
    titleKey: "tourWizardTemplateSectionPricing",
    paths: [
      "pricing.requiresPayment",
      "pricing.basePricePerPerson",
      "pricing.includesTourInsurance",
      "overview.nonAttendanceDetails",
      "participants.minRequiredPeaks",
      "participants.minimumAge",
      "participants.maximumAge",
      "participants.nationalIdRequired",
      "participants.sportsInsuranceRequired",
      "participants.fitnessLevel",
      "participants.fitnessPrerequisiteText",
    ],
  },
  {
    id: "marketing",
    titleKey: "tourWizardTemplateSectionMarketing",
    paths: [
      "program.difficultyLevel",
      "program.hikingHoursApprox",
      "program.hikingGoHours",
      "program.hikingReturnHours",
      "metrics.elevationGain",
      "program.itinerary",
      "program.shortDescription",
      "program.longDescription",
      "program.themeIds",
      "photos",
      "policies.policiesText",
      "policies.cancellationDeadlineHours",
      "policies.cancellationPenaltyPercentage",
    ],
  },
] as const;

export type ResolvedTourWizardTemplateSectionGroup = TourWizardTemplateSectionGroup & {
  readonly paths: readonly string[];
};

/** Partition Layer C paths into semantic cards; append any unmapped paths to the last card. */
export function groupTemplateBuilderFieldPaths(
  fieldPaths: readonly string[],
): readonly ResolvedTourWizardTemplateSectionGroup[] {
  const available = new Set(fieldPaths);
  const assigned = new Set<string>();
  const sections: ResolvedTourWizardTemplateSectionGroup[] = [];

  for (const group of TOUR_WIZARD_TEMPLATE_SECTION_GROUPS) {
    const paths = group.paths.filter((path) => {
      if (!available.has(path) || assigned.has(path)) {
        return false;
      }
      assigned.add(path);
      return true;
    });
    if (paths.length > 0) {
      sections.push({ ...group, paths });
    }
  }

  const overflow = fieldPaths.filter((path) => !assigned.has(path));
  if (overflow.length > 0) {
    const last = sections[sections.length - 1];
    if (last) {
      sections[sections.length - 1] = {
        ...last,
        paths: [...last.paths, ...overflow],
      };
    } else {
      sections.push({
        id: "overflow",
        titleKey: "tourWizardTemplateSectionMarketing",
        paths: overflow,
      });
    }
  }

  return sections;
}
