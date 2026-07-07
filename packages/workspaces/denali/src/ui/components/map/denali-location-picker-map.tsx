"use client";

import dynamic from "next/dynamic";

import type {
  DenaliLocationPickerMapInnerProps,
  DenaliMapCoordinates,
} from "./denali-location-picker-map-inner";

export type { DenaliMapCoordinates, DenaliLocationPickerMapInnerProps };
export { DenaliLocationPickerMapInner } from "./denali-location-picker-map-inner";
export { ensureLeafletDefaultIcon } from "./leaflet-default-icon";

const MapLoadingShell = ({ height = 220 }: { height?: number }) => (
  <div
    aria-hidden
    className="denali-wizard-composite__map-skeleton"
    style={{ height, width: "100%" }}
  />
);

/** Leaflet map shell — loaded client-only to avoid SSR `window` errors. */
export const DenaliLocationPickerMap = dynamic(
  () =>
    import("./denali-location-picker-map-inner").then((mod) => mod.DenaliLocationPickerMapInner),
  {
    ssr: false,
    loading: () => <MapLoadingShell />,
  }
);
