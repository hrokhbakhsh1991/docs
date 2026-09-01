"use client";

import dynamic from "next/dynamic";

import type {
  DenaliLocationPickerMapInnerProps,
  DenaliMapCoordinates,
} from "./denali-location-picker-map-inner";

export type { DenaliMapCoordinates, DenaliLocationPickerMapInnerProps };

const MapLoadingShell = ({
  height = 220,
  layout = "fixed",
}: Pick<DenaliLocationPickerMapInnerProps, "height" | "layout">) => (
  <div
    aria-hidden
    className={
      layout === "fill"
        ? "denali-wizard-composite__map-skeleton denali-wizard-composite__map-skeleton--fill"
        : "denali-wizard-composite__map-skeleton"
    }
    style={layout === "fill" ? undefined : { height, width: "100%" }}
  />
);

/** Leaflet map shell — loaded client-only to avoid SSR `window` errors. */
export const DenaliLocationPickerMap = dynamic<DenaliLocationPickerMapInnerProps>(
  () =>
    import("./denali-location-picker-map-inner").then((mod) => mod.DenaliLocationPickerMapInner),
  {
    ssr: false,
    loading: () => <MapLoadingShell />,
  }
);
