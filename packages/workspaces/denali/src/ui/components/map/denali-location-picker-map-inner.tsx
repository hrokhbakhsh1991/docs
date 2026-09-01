"use client";

import L from "leaflet";
import { memo, useEffect, useRef } from "react";

import "leaflet/dist/leaflet.css";

import { ensureLeafletDefaultIcon } from "./leaflet-default-icon";

export type DenaliMapCoordinates = {
  latitude: number;
  longitude: number;
} | null;

export type DenaliLocationPickerMapInnerProps = {
  value: DenaliMapCoordinates;
  onChange: (_coords: { latitude: number; longitude: number }) => void;
  defaultCenter?: { latitude: number; longitude: number };
  height?: number;
  layout?: "fixed" | "fill";
  scrollWheelZoom?: boolean;
  resizeSignal?: number;
  "data-testid"?: string;
};

const DEFAULT_CENTER = { latitude: 35.6892, longitude: 51.389 };
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

type LeafletContainer = HTMLDivElement & { _leaflet_id?: number };

function resetLeafletContainer(element: LeafletContainer): void {
  if (element._leaflet_id != null) {
    element.replaceChildren();
    delete element._leaflet_id;
  }
}

function DenaliLocationPickerMapInnerComponent({
  value,
  onChange,
  defaultCenter = DEFAULT_CENTER,
  height = 220,
  layout = "fixed",
  scrollWheelZoom = true,
  resizeSignal = 0,
  "data-testid": testId,
}: DenaliLocationPickerMapInnerProps) {
  const containerRef = useRef<LeafletContainer>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const initialValueRef = useRef(value);
  const initialCenterRef = useRef(defaultCenter);
  onChangeRef.current = onChange;

  useEffect(() => {
    const container = containerRef.current;
    if (container == null) {
      return;
    }

    ensureLeafletDefaultIcon();
    resetLeafletContainer(container);

    const initialValue = initialValueRef.current;
    const initialCenter = initialCenterRef.current;
    const mapCenter = initialValue
      ? L.latLng(initialValue.latitude, initialValue.longitude)
      : L.latLng(initialCenter.latitude, initialCenter.longitude);
    const initialZoom = initialValue ? 14 : 6;

    const map = L.map(container, { scrollWheelZoom }).setView(mapCenter, initialZoom);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION }).addTo(map);

    map.on("click", (event) => {
      onChangeRef.current({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    });

    mapRef.current = map;
    const resizeTimer = window.setTimeout(() => map.invalidateSize(), 0);

    return () => {
      window.clearTimeout(resizeTimer);
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
      resetLeafletContainer(container);
    };
  }, [scrollWheelZoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (map == null) {
      return;
    }
    let frame = 0;
    frame = window.requestAnimationFrame(() => {
      map.invalidateSize();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [resizeSignal]);

  useEffect(() => {
    const map = mapRef.current;
    if (map == null) {
      return;
    }

    if (value == null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    const latlng = L.latLng(value.latitude, value.longitude);
    if (markerRef.current == null) {
      const marker = L.marker(latlng, { draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const position = marker.getLatLng();
        onChangeRef.current({ latitude: position.lat, longitude: position.lng });
      });
      markerRef.current = marker;
      map.setView(latlng, 14);
      return;
    }

    markerRef.current.setLatLng(latlng);
    if (!map.getBounds().contains(latlng)) {
      map.panTo(latlng);
    }
  }, [value?.latitude, value?.longitude]);

  return (
    <div
      ref={containerRef}
      data-testid={testId}
      className={
        layout === "fill"
          ? "denali-wizard-composite__interactive-map denali-wizard-composite__interactive-map--fill"
          : "denali-wizard-composite__interactive-map"
      }
      style={layout === "fill" ? undefined : { height, width: "100%" }}
    />
  );
}

export const DenaliLocationPickerMapInner = memo(DenaliLocationPickerMapInnerComponent);
