import type { DenaliMapCoordinates } from "../components/map/denali-location-picker-map-inner";

export type DenaliLocationAddressValue = {
  readonly address?: string;
  readonly latitude?: number;
  readonly longitude?: number;
};

export function cloneLocationAddressValue(
  value: DenaliLocationAddressValue
): DenaliLocationAddressValue {
  return {
    ...(value.address !== undefined ? { address: value.address } : {}),
    ...(value.latitude !== undefined ? { latitude: value.latitude } : {}),
    ...(value.longitude !== undefined ? { longitude: value.longitude } : {}),
  };
}

export function hasLocationCoordinates(value: DenaliLocationAddressValue): boolean {
  return (
    value.latitude !== undefined &&
    value.longitude !== undefined &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude)
  );
}

export function toMapCoordinates(value: DenaliLocationAddressValue): DenaliMapCoordinates {
  if (!hasLocationCoordinates(value)) {
    return null;
  }
  return { latitude: value.latitude!, longitude: value.longitude! };
}

export function mergeLocationAddressPatch(
  current: DenaliLocationAddressValue,
  patch: Partial<DenaliLocationAddressValue>
): DenaliLocationAddressValue {
  const merged: {
    address?: string;
    latitude?: number;
    longitude?: number;
  } = {
    address: "address" in patch ? patch.address : current.address,
    latitude: "latitude" in patch ? patch.latitude : current.latitude,
    longitude: "longitude" in patch ? patch.longitude : current.longitude,
  };
  return cloneLocationAddressValue(merged);
}

/** Manual address edit without a geocoded suggestion clears stale coordinates. */
export function patchManualAddressEdit(
  _current: DenaliLocationAddressValue,
  address: string
): DenaliLocationAddressValue {
  return {
    address,
    latitude: undefined,
    longitude: undefined,
  };
}

export function locationAddressValuesEqual(
  left: DenaliLocationAddressValue,
  right: DenaliLocationAddressValue
): boolean {
  return (
    (left.address ?? "") === (right.address ?? "") &&
    left.latitude === right.latitude &&
    left.longitude === right.longitude
  );
}

export type LocationCoordinates = {
  readonly latitude: number;
  readonly longitude: number;
};

export type LocationModalAsyncSession = {
  reverseRequestId: number;
  geolocationRequestId: number;
};

export function createLocationModalAsyncSession(): LocationModalAsyncSession {
  return { reverseRequestId: 0, geolocationRequestId: 0 };
}

export function resetLocationModalAsyncSession(session: LocationModalAsyncSession): void {
  session.reverseRequestId += 1;
  session.geolocationRequestId += 1;
}

export function isStaleAsyncRequest(requestId: number, currentId: number): boolean {
  return requestId !== currentId;
}

export function invalidateGeolocationRequests(session: LocationModalAsyncSession): void {
  session.geolocationRequestId += 1;
}

export function invalidateReverseRequests(session: LocationModalAsyncSession): number {
  session.reverseRequestId += 1;
  return session.reverseRequestId;
}

export function coordsOnlyLocationDraft(coords: LocationCoordinates): DenaliLocationAddressValue {
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
  };
}

export function resolveReverseGeocodeModalDraft(
  coords: LocationCoordinates,
  address: string | null
): DenaliLocationAddressValue {
  if (address !== null && address.trim().length > 0) {
    return {
      address,
      latitude: coords.latitude,
      longitude: coords.longitude,
    };
  }
  return coordsOnlyLocationDraft(coords);
}

export type MapLocationIntent = {
  reverseRequestId: number;
  pendingDraft: DenaliLocationAddressValue;
};

/** Map click/drag — clear stale address; invalidate in-flight geolocation. */
export function beginMapLocationIntent(
  session: LocationModalAsyncSession,
  coords: LocationCoordinates
): MapLocationIntent {
  invalidateGeolocationRequests(session);
  const reverseRequestId = invalidateReverseRequests(session);
  return {
    reverseRequestId,
    pendingDraft: coordsOnlyLocationDraft(coords),
  };
}

export type ReverseGeocodeIntentResult =
  | { readonly stale: true }
  | { readonly stale: false; readonly draft: DenaliLocationAddressValue };

export function applyReverseGeocodeToMapIntent(
  session: LocationModalAsyncSession,
  reverseRequestId: number,
  coords: LocationCoordinates,
  address: string | null
): ReverseGeocodeIntentResult {
  if (isStaleAsyncRequest(reverseRequestId, session.reverseRequestId)) {
    return { stale: true };
  }
  return {
    stale: false,
    draft: resolveReverseGeocodeModalDraft(coords, address),
  };
}

export function beginSearchSelectionIntent(
  session: LocationModalAsyncSession,
  item: { addressText: string; latitude: number; longitude: number }
): DenaliLocationAddressValue {
  invalidateGeolocationRequests(session);
  invalidateReverseRequests(session);
  return {
    address: item.addressText,
    latitude: item.latitude,
    longitude: item.longitude,
  };
}

export function beginManualAddressSearchIntent(
  session: LocationModalAsyncSession,
  address: string
): DenaliLocationAddressValue {
  invalidateGeolocationRequests(session);
  invalidateReverseRequests(session);
  return patchManualAddressEdit({}, address);
}

export function beginGeolocationIntent(session: LocationModalAsyncSession): number {
  return ++session.geolocationRequestId;
}

export type GeolocationPositionIntentResult =
  | { readonly stale: true }
  | {
      readonly stale: false;
      readonly reverseRequestId: number;
      readonly pendingDraft: DenaliLocationAddressValue;
    };

export function applyGeolocationPositionIntent(
  session: LocationModalAsyncSession,
  geolocationRequestId: number,
  coords: LocationCoordinates
): GeolocationPositionIntentResult {
  if (isStaleAsyncRequest(geolocationRequestId, session.geolocationRequestId)) {
    return { stale: true };
  }
  const reverseRequestId = invalidateReverseRequests(session);
  return {
    stale: false,
    reverseRequestId,
    pendingDraft: coordsOnlyLocationDraft(coords),
  };
}

export function applyGeolocationReverseIntent(
  session: LocationModalAsyncSession,
  geolocationRequestId: number,
  reverseRequestId: number,
  coords: LocationCoordinates,
  address: string | null
): ReverseGeocodeIntentResult {
  if (
    isStaleAsyncRequest(geolocationRequestId, session.geolocationRequestId) ||
    isStaleAsyncRequest(reverseRequestId, session.reverseRequestId)
  ) {
    return { stale: true };
  }
  return {
    stale: false,
    draft: resolveReverseGeocodeModalDraft(coords, address),
  };
}

export function isLocationModalConfirmDisabled(
  reversePending: boolean,
  geolocationPending: boolean
): boolean {
  return reversePending || geolocationPending;
}

export function isLocationAddressDraftEmpty(value: DenaliLocationAddressValue): boolean {
  return (value.address?.trim() ?? "").length === 0 && !hasLocationCoordinates(value);
}

/** Confirm patch — empty draft clears address/coordinates without bypassing merge semantics. */
export function resolveLocationConfirmPatch(
  draft: DenaliLocationAddressValue
): DenaliLocationAddressValue {
  if (isLocationAddressDraftEmpty(draft)) {
    return {
      address: undefined,
      latitude: undefined,
      longitude: undefined,
    };
  }
  return cloneLocationAddressValue(draft);
}
