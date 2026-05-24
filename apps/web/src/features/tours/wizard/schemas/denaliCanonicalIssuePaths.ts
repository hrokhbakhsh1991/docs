import type { FieldPath } from "react-hook-form";

import type { DenaliCreateTourWizardForm } from "./denaliTourCreateFormModel";

/** Maps {@link denaliCanonicalTourSchema} issue paths → legacy RHF paths for error display. */
export function canonicalZodPathToFormFieldPath(
  path: readonly (string | number)[],
): FieldPath<DenaliCreateTourWizardForm> {
  if (path.length === 0) {
    return "basicInfo.title";
  }

  const [head, ...rest] = path;
  const tail = rest.join(".");

  switch (head) {
    case "title":
      return "basicInfo.title";
    case "category":
    case "duration":
      return "basicInfo.tourType";
    case "destinationId":
      return "basicInfo.destinationId";
    case "startDateTime":
      return "basicInfo.startDateTime";
    case "endDateTime":
      return "basicInfo.endDateTime";
    case "capacityMax":
      return "basicInfo.capacityMax";
    case "capacityMin":
      return "basicInfo.capacityMin";
    case "meetingPoint":
      return "basicInfo.meetingPoint";
    case "startPointLocationText":
      return "basicInfo.startPointLocationText";
    case "gatheringPoint":
    case "startPoint":
    case "summitPoint":
    case "campPoint":
    case "endPoint":
      if (tail.length > 0) {
        return `basicInfo.${head}.${tail}` as FieldPath<DenaliCreateTourWizardForm>;
      }
      return `basicInfo.${head}` as FieldPath<DenaliCreateTourWizardForm>;
    case "approximateReturnTime":
      return "basicInfo.approximateReturnTime";
    case "leaderUserIds":
      return "basicInfo.leaderUserIds";
    case "requiresLocalGuide":
      return "basicInfo.requiresLocalGuide";
    case "localGuideName":
      return "basicInfo.localGuideName";
    case "requiresManualAdminApproval":
      return "basicInfo.requiresManualAdminApproval";
    case "socialMediaLink":
      return "basicInfo.socialMediaLink";
    case "program":
      if (tail === "themeIds") return "programNature.themeIds";
      if (tail === "shortDescription") return "programNature.shortDescription";
      if (tail === "longDescription") return "programNature.longDescription";
      if (tail === "difficultyLevel") return "programNature.difficultyLevel";
      if (tail === "hikingHoursApprox") return "programNature.hikingHoursApprox";
      if (tail === "hikingGoHours") return "programNature.hikingGoHours";
      if (tail === "hikingReturnHours") return "programNature.hikingReturnHours";
      if (tail.startsWith("itinerary")) {
        return `programNature.${tail}` as FieldPath<DenaliCreateTourWizardForm>;
      }
      return "programNature.themeIds";
    case "transport":
      if (tail === "mode") return "transport.transportMode";
      if (tail === "transportCost") return "transport.transportCost";
      if (tail === "allowPersonalCar") return "transport.allowPersonalCar";
      if (tail === "dongAmount") return "transport.dongAmount";
      if (tail === "seatPreference") return "transport.seatPreference";
      return "transport.transportMode";
    case "pricing":
      if (tail === "requiresPayment") return "pricingPayment.requiresPayment";
      if (tail === "basePricePerPerson") return "pricingPayment.basePricePerPerson";
      if (tail === "includesTourInsurance") return "pricingPayment.includesTourInsurance";
      return "pricingPayment.paymentMode";
    case "participants":
      if (tail === "minimumAge") return "participantRequirements.minimumAge";
      if (tail === "maximumAge") return "participantRequirements.maximumAge";
      if (tail === "fitnessLevel") return "participantRequirements.fitnessLevel";
      if (tail === "nationalIdRequired")
        return "participantRequirements.nationalIdRequired";
      if (tail === "sportsInsuranceRequired")
        return "participantRequirements.sportsInsuranceRequired";
      if (tail === "fitnessPrerequisiteText")
        return "participantRequirements.fitnessPrerequisiteText";
      if (tail === "gearItems" || tail.startsWith("gearItems.")) {
        return `participantRequirements.${tail}` as FieldPath<DenaliCreateTourWizardForm>;
      }
      if (tail === "minRequiredPeaks") return "participantRequirements.minRequiredPeaks";
      return "participantRequirements.minimumAge";
    case "policies":
      if (tail === "policiesText") return "policies.policiesText";
      if (tail === "cancellationDeadlineHours") return "policies.cancellationDeadlineHours";
      if (tail === "cancellationPenaltyPercentage")
        return "policies.cancellationPenaltyPercentage";
      return "policies.policiesText";
    default:
      return `${String(head)}.${tail}` as FieldPath<DenaliCreateTourWizardForm>;
  }
}
