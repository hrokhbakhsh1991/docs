export type TourDetailGearLists = {
  required: { id: string; name: string }[];
  optional: { id: string; name: string }[];
};

export function shouldShowTourDetailEquipmentCard(input: {
  gearLists: TourDetailGearLists;
  gearRequiredIds?: string[];
  gearOptionalIds?: string[];
}): boolean {
  const resolvedCount = input.gearLists.required.length + input.gearLists.optional.length;
  if (resolvedCount > 0) {
    return true;
  }
  return (
    (input.gearRequiredIds?.length ?? 0) > 0 || (input.gearOptionalIds?.length ?? 0) > 0
  );
}

export function isTourDetailGearAggregationIncomplete(input: {
  participationPresent: boolean;
  gearLists: TourDetailGearLists;
  gearRequiredIds?: string[];
  gearOptionalIds?: string[];
}): boolean {
  if (!input.participationPresent) {
    return false;
  }
  const resolvedCount = input.gearLists.required.length + input.gearLists.optional.length;
  if (resolvedCount > 0) {
    return false;
  }
  return (
    (input.gearRequiredIds?.length ?? 0) > 0 || (input.gearOptionalIds?.length ?? 0) > 0
  );
}
