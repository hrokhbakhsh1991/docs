import type { ToursNewValidationMessages } from "../models/tours-new-validation-messages";

/** Maps `useTranslations("tours.new")` into Zod message bundle for create-tour schemas. */
export function buildToursNewValidationMessages(
  t: (key: string, values?: Record<string, string | number>) => string,
): ToursNewValidationMessages {
  return {
    titleRequired: t("validationTitleRequired"),
    titleTooShort: t("validationTitleTooShort"),
    titleTooLong: t("validationTitleTooLong"),
    linkTooLong: t("validationLinkTooLong"),
    enterValidUrl: t("validationEnterValidUrl"),
    meetingPointTooLong: t("validationMeetingPointTooLong"),
    capacityInvalid: t("validationCapacityInvalid"),
    capacityWholeNumber: t("validationCapacityWholeNumber"),
    capacityMinOne: t("validationCapacityMinOne"),
    priceInvalid: t("validationPriceInvalid"),
    priceMinZero: t("validationPriceMinZero"),
    intBetween: (min, max) => t("validationIntBetween", { min, max }),
    dayMinOne: t("validationDayMinOne"),
    difficultyRequiredMountain: t("validationDifficultyRequiredMountain"),
    difficultyRatingOutOfRange: t("validationDifficultyRatingOutOfRange"),
    difficultyRatingHalfStep: t("validationDifficultyRatingHalfStep"),
    minimumAgeRequiredMountain: t("validationMinimumAgeRequiredMountain"),
    gearRequiredMountain: t("validationGearRequiredMountain"),
    gearIdEachInvalid: t("validationGearIdEachInvalid"),
    tourThemeIdEachInvalid: t("validationTourThemeIdEachInvalid"),
    meetingPointRequiredMountain: t("validationMeetingPointRequiredMountain"),
    departureDateRequiredMountain: t("validationDepartureDateRequiredMountain"),
    departureDateNotPast: t("validationDepartureDateNotPast"),
    returnDateNotPast: t("validationReturnDateNotPast"),
    returnDateBeforeDeparture: t("validationReturnDateBeforeDeparture"),
    timeFormatInvalid: t("validationTimeFormatInvalid"),
    audienceOverlap: t("validationAudienceOverlap"),
  };
}
