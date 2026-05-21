"use client";

import dynamic from "next/dynamic";

import type {
  DenaliLocationPickerMapInnerProps,
  DenaliMapCoordinates,
} from "./DenaliLocationPickerMapInner";

export type { DenaliMapCoordinates, DenaliLocationPickerMapInnerProps };

const MapLoadingShell = ({ height = 220 }: { height?: number }) => (
  <div
    aria-hidden
    style={{
      height,
      width: "100%",
      borderRadius: 8,
      background: "var(--color-surface-subtle, #f1f5f9)",
      border: "1px solid var(--color-border-subtle, #e2e8f0)",
    }}
  />
);

/** Leaflet map shell — loaded client-only to avoid SSR `window` errors. */
export const DenaliLocationPickerMap = dynamic(
  () =>
    import("./DenaliLocationPickerMapInner").then((mod) => mod.DenaliLocationPickerMapInner),
  {
    ssr: false,
    loading: () => <MapLoadingShell />,
  },
);
