import { isDenaliNatureTourKind } from "./denali-destination-picker-filter";

/** ED-LOC-NATURE-01 — nature summit copy is peak-free; mountain keeps «قله». */
export function resolveDenaliLocationZoneLabelKey(path: string, tourKind: string): string {
  if (path === "summitPoint" && isDenaliNatureTourKind(tourKind)) {
    return "composites.locationTypes.summitPointNature";
  }
  return `composites.locationTypes.${path}`;
}
