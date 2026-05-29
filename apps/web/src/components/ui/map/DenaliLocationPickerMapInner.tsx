"use client";

import { memo, useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { LatLngExpression } from "leaflet";

import "leaflet/dist/leaflet.css";

import { ensureLeafletDefaultIcon } from "./leaflet-default-icon";

export type DenaliMapCoordinates = {
  latitude: number;
  longitude: number;
} | null;

export type DenaliLocationPickerMapInnerProps = {
  value: DenaliMapCoordinates;
  onChange: (_coords: { latitude: number; longitude: number }) => void;
  /** When no coordinates yet, center map here (Tehran default). */
  defaultCenter?: { latitude: number; longitude: number };
  height?: number;
  "data-testid"?: string;
};

const DEFAULT_CENTER = { latitude: 35.6892, longitude: 51.389 };

function MapFlyTo({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([latitude, longitude], 14, { duration: 0.8 });
  }, [latitude, longitude, map]);
  return null;
}

function MapClickHandler({
  onChange,
}: {
  onChange: (_coords: { latitude: number; longitude: number }) => void;
}) {
  useMapEvents({
    click(event) {
      onChange({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
  });
  return null;
}

function DenaliLocationPickerMapInnerComponent({
  value,
  onChange,
  defaultCenter = DEFAULT_CENTER,
  height = 220,
  "data-testid": testId,
}: DenaliLocationPickerMapInnerProps) {
  /** Defer MapContainer until the wrapper is in the DOM (modal portal + Strict Mode). */
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    ensureLeafletDefaultIcon();
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMapReady(true));
    return () => {
      cancelAnimationFrame(frame);
      setMapReady(false);
    };
  }, []);

  const center: LatLngExpression = value
    ? [value.latitude, value.longitude]
    : [defaultCenter.latitude, defaultCenter.longitude];

  const zoom = value ? 14 : 6;

  return (
    <div
      data-testid={testId}
      style={{
        height,
        width: "100%",
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid var(--color-slate-200)",
      }}
    >
      {mapReady ? (
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onChange={onChange} />
        {value ? (
          <>
            <Marker
              position={[value.latitude, value.longitude]}
              draggable
              eventHandlers={{
                dragend: (event) => {
                  const { lat, lng } = event.target.getLatLng();
                  onChange({ latitude: lat, longitude: lng });
                },
              }}
            />
            <MapFlyTo latitude={value.latitude} longitude={value.longitude} />
          </>
        ) : null}
      </MapContainer>
      ) : null}
    </div>
  );
}

export const DenaliLocationPickerMapInner = memo(DenaliLocationPickerMapInnerComponent);
