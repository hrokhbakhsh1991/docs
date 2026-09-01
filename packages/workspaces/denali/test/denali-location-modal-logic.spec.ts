import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyGeolocationPositionIntent,
  applyGeolocationReverseIntent,
  applyReverseGeocodeToMapIntent,
  beginGeolocationIntent,
  beginMapLocationIntent,
  beginSearchSelectionIntent,
  cloneLocationAddressValue,
  createLocationModalAsyncSession,
  hasLocationCoordinates,
  isLocationAddressDraftEmpty,
  isLocationModalConfirmDisabled,
  locationAddressValuesEqual,
  mergeLocationAddressPatch,
  patchManualAddressEdit,
  resolveLocationConfirmPatch,
  toMapCoordinates,
} from "../src/ui/logic/denali-location-modal-logic";

const A = { address: "Tehran A", latitude: 35.6892, longitude: 51.389 };
const B = { latitude: 35.7, longitude: 51.4 };
const C = { latitude: 35.8, longitude: 51.5 };

describe("denali-location-modal-logic.spec.ts", () => {
  it("DN-LOC-MODAL-01 clone and equality preserve optional fields", () => {
    const value = { address: "Tehran", latitude: 35.7, longitude: 51.4 };
    const cloned = cloneLocationAddressValue(value);
    assert.notEqual(cloned, value);
    assert.deepEqual(cloned, value);
    assert.equal(locationAddressValuesEqual(value, cloned), true);
  });

  it("DN-LOC-MODAL-02 manual address edit clears stale coordinates", () => {
    const current = { address: "Old", latitude: 35.7, longitude: 51.4 };
    const next = patchManualAddressEdit(current, "New typed address");
    assert.equal(next.address, "New typed address");
    assert.equal(next.latitude, undefined);
    assert.equal(next.longitude, undefined);
    assert.equal(hasLocationCoordinates(next), false);
    assert.equal(toMapCoordinates(next), null);
  });

  it("DN-LOC-MODAL-03 merge patch can set and clear coordinates", () => {
    const merged = mergeLocationAddressPatch(
      { address: "A", latitude: 1, longitude: 2 },
      { latitude: 35.6892, longitude: 51.389 }
    );
    assert.deepEqual(merged, { address: "A", latitude: 35.6892, longitude: 51.389 });

    const cleared = mergeLocationAddressPatch(merged, {
      latitude: undefined,
      longitude: undefined,
    });
    assert.equal(cleared.latitude, undefined);
    assert.equal(cleared.longitude, undefined);
  });

  it("DN-LOC-MODAL-04 hasLocationCoordinates rejects partial or non-finite values", () => {
    assert.equal(hasLocationCoordinates({ latitude: 35.7 }), false);
    assert.equal(hasLocationCoordinates({ latitude: Number.NaN, longitude: 51.4 }), false);
    assert.equal(hasLocationCoordinates({ latitude: 35.7, longitude: 51.4 }), true);
  });

  it("DN-LOC-MODAL-20 geolocation cannot overwrite newer manual map selection", () => {
    const session = createLocationModalAsyncSession();
    const geolocationRequestId = beginGeolocationIntent(session);
    const mapIntent = beginMapLocationIntent(session, B);

    const staleGeo = applyGeolocationPositionIntent(session, geolocationRequestId, C);
    assert.equal(staleGeo.stale, true);

    const reverseB = applyReverseGeocodeToMapIntent(
      session,
      mapIntent.reverseRequestId,
      B,
      "Address B"
    );
    assert.equal(reverseB.stale, false);
    if (!reverseB.stale) {
      assert.deepEqual(reverseB.draft, {
        address: "Address B",
        latitude: B.latitude,
        longitude: B.longitude,
      });
    }
  });

  it("DN-LOC-MODAL-21 latest geolocation request wins over an older one", () => {
    const session = createLocationModalAsyncSession();
    const first = beginGeolocationIntent(session);
    const second = beginGeolocationIntent(session);

    const coords1 = { latitude: 35.1, longitude: 51.1 };
    const coords2 = { latitude: 35.2, longitude: 51.2 };

    const acceptedSecond = applyGeolocationPositionIntent(session, second, coords2);
    assert.equal(acceptedSecond.stale, false);
    if (!acceptedSecond.stale) {
      assert.deepEqual(acceptedSecond.pendingDraft, coords2);
    }

    const staleFirst = applyGeolocationPositionIntent(session, first, coords1);
    assert.equal(staleFirst.stale, true);
  });

  it("DN-LOC-MODAL-22 reverse-geocode failure clears stale address on map move", () => {
    const session = createLocationModalAsyncSession();
    const mapIntent = beginMapLocationIntent(session, B);

    assert.equal(mapIntent.pendingDraft.address, undefined);
    assert.deepEqual(mapIntent.pendingDraft, B);

    const failed = applyReverseGeocodeToMapIntent(session, mapIntent.reverseRequestId, B, null);
    assert.equal(failed.stale, false);
    if (!failed.stale) {
      assert.equal(failed.draft.address, undefined);
      assert.deepEqual(failed.draft, B);
      assert.notEqual(failed.draft.address, A.address);
    }
  });

  it("DN-LOC-MODAL-23 reverse failure never permits stale address with new coordinates", () => {
    const session = createLocationModalAsyncSession();
    const mapIntent = beginMapLocationIntent(session, B);
    const failed = applyReverseGeocodeToMapIntent(session, mapIntent.reverseRequestId, B, null);

    assert.equal(failed.stale, false);
    if (!failed.stale) {
      assert.equal(isLocationModalConfirmDisabled(false, false), false);
      assert.deepEqual(cloneLocationAddressValue(failed.draft), B);
      assert.notDeepEqual(failed.draft, {
        address: A.address,
        latitude: B.latitude,
        longitude: B.longitude,
      });
    }
  });

  it("DN-LOC-MODAL-24 successful reverse geocode still establishes address + coordinates", () => {
    const session = createLocationModalAsyncSession();
    const mapIntent = beginMapLocationIntent(session, B);
    const resolved = applyReverseGeocodeToMapIntent(
      session,
      mapIntent.reverseRequestId,
      B,
      "Address B"
    );

    assert.equal(resolved.stale, false);
    if (!resolved.stale) {
      assert.deepEqual(resolved.draft, {
        address: "Address B",
        latitude: B.latitude,
        longitude: B.longitude,
      });
      assert.equal(isLocationModalConfirmDisabled(false, false), false);
    }
  });

  it("DN-LOC-MODAL-25 stale reverse response cannot overwrite newer map selection", () => {
    const session = createLocationModalAsyncSession();
    const mapA = beginMapLocationIntent(session, { latitude: 35.6, longitude: 51.3 });
    const mapB = beginMapLocationIntent(session, B);

    const staleA = applyReverseGeocodeToMapIntent(
      session,
      mapA.reverseRequestId,
      { latitude: 35.6, longitude: 51.3 },
      "Address A"
    );
    assert.equal(staleA.stale, true);

    const currentB = applyReverseGeocodeToMapIntent(
      session,
      mapB.reverseRequestId,
      B,
      "Address B"
    );
    assert.equal(currentB.stale, false);
    if (!currentB.stale) {
      assert.deepEqual(currentB.draft, {
        address: "Address B",
        latitude: B.latitude,
        longitude: B.longitude,
      });
    }
  });

  it("DN-LOC-UX-08 resolveLocationConfirmPatch clears address and coordinates", () => {
    assert.equal(isLocationAddressDraftEmpty({}), true);
    assert.equal(isLocationAddressDraftEmpty({ address: "  " }), true);
    assert.equal(isLocationAddressDraftEmpty({ latitude: 35.7, longitude: 51.4 }), false);

    const cleared = resolveLocationConfirmPatch({});
    assert.deepEqual(cleared, {
      address: undefined,
      latitude: undefined,
      longitude: undefined,
    });

    const kept = resolveLocationConfirmPatch({
      address: "Tehran",
      latitude: 35.6892,
      longitude: 51.389,
    });
    assert.deepEqual(kept, {
      address: "Tehran",
      latitude: 35.6892,
      longitude: 51.389,
    });
  });

  it("DN-LOC-UX-09 merge patch clears coordinates for confirm-remove flow", () => {
    const current = { address: "Old", latitude: 35.7, longitude: 51.4 };
    const cleared = mergeLocationAddressPatch(current, resolveLocationConfirmPatch({}));
    assert.equal(cleared.address, undefined);
    assert.equal(cleared.latitude, undefined);
    assert.equal(cleared.longitude, undefined);
    assert.equal(hasLocationCoordinates(cleared), false);
  });
});
