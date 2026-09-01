import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const readSrc = (relativePath: string) =>
  readFileSync(join(root, relativePath), "utf8");

describe("denali-location-map-modal.spec.ts", () => {
  const modal = readSrc("src/ui/components/denali-location-map-modal.tsx");
  const picker = readSrc("src/ui/components/denali-location-address-picker.tsx");
  const mapInner = readSrc("src/ui/components/map/denali-location-picker-map-inner.tsx");
  const css = readFileSync(join(root, "theme/wizard-fields.css"), "utf8");
  const faMessages = readFileSync(join(root, "messages/fa/wizard.json"), "utf8");
  const enMessages = readFileSync(join(root, "messages/en/wizard.json"), "utf8");

  it("DN-LOC-MODAL-10 modal draft clones canonical on open and confirms once", () => {
    assert.match(modal, /cloneLocationAddressValue\(initialValue\)/);
    assert.match(modal, /setModalDraft/);
    assert.match(modal, /onConfirm\(cloneLocationAddressValue\(modalDraft\)\)/);
    assert.match(modal, /confirmedRef/);
    assert.doesNotMatch(modal, /onChange\(/);
  });

  it("DN-LOC-MODAL-11 cancel path does not call onConfirm; confirm clears via picker patch", () => {
    assert.match(modal, /if \(!confirmedRef\.current\)/);
    assert.match(modal, /onCancel\(\)/);
    assert.match(picker, /resolveLocationConfirmPatch\(next\)/);
  });

  it("DN-LOC-MODAL-12 search and map mutate modalDraft only until confirm", () => {
    assert.match(modal, /patchManualAddressEdit|beginManualAddressSearchIntent/);
    assert.match(modal, /applySearchSelection/);
    assert.match(modal, /handleMapChange/);
    assert.match(modal, /asyncSessionRef/);
    assert.match(modal, /beginMapLocationIntent/);
    assert.match(modal, /invalidateGeolocationRequests|beginSearchSelectionIntent/);
    assert.match(modal, /disabled=\{confirmDisabled\}/);
    assert.match(modal, /isLocationModalConfirmDisabled/);
  });

  it("DN-LOC-MODAL-13 inline picker has no permanent map; opens modal on demand", () => {
    assert.match(picker, /DenaliLocationMapModal/);
    assert.doesNotMatch(picker, /DenaliLocationPickerMap/);
    assert.match(picker, /mapModalOpenAction|mapModalChangeAction/);
    assert.match(picker, /modalOpen/);
    assert.doesNotMatch(picker, /searchLabel/);
    assert.doesNotMatch(picker, /searchHint/);
    assert.doesNotMatch(picker, /pickFromMapHint/);
    assert.match(picker, /inlineEmptyHint/);
    assert.match(picker, /mapModalRemoveAction/);
  });

  it("DN-LOC-MODAL-14 map lifecycle supports resize signal and fill layout", () => {
    assert.match(mapInner, /resizeSignal/);
    assert.match(mapInner, /invalidateSize/);
    assert.match(mapInner, /layout === "fill"/);
    assert.match(mapInner, /scrollWheelZoom/);
    assert.doesNotMatch(mapInner, /flyTo/);
  });

  it("DN-LOC-MODAL-15 responsive sheet vs dialog layout", () => {
    assert.match(modal, /matchMedia\("\(max-width: 640px\)"\)/);
    assert.match(modal, /denali-location-map-modal--sheet/);
    assert.match(modal, /denali-location-map-modal--dialog/);
    assert.match(modal, /scrollWheelZoom=\{!isMobileSheet\}/);
  });

  it("DN-LOC-MODAL-16 gathering points pass onPlaceSelect through picker into modal", () => {
    assert.match(picker, /onPlaceSelect=\{onPlaceSelect\}/);
    assert.match(picker, /locationContextName/);
    const gathering = readSrc("src/ui/fields/denali-gathering-points-field.tsx");
    assert.match(gathering, /onPlaceSelect=\{\(place\)/);
    assert.match(gathering, /locationPickerContext/);
    assert.match(modal, /pendingPlaceSelectRef/);
    assert.match(modal, /onPlaceSelect\?\.\(place\)/);
    assert.doesNotMatch(modal, /onPlaceSelect\?\.\(item\)/);
  });

  it("DN-LOC-MODAL-17 accessibility hooks on native dialog", () => {
    assert.match(modal, /<dialog/);
    assert.match(modal, /aria-labelledby/);
    assert.match(modal, /aria-describedby/);
    assert.match(modal, /aria-busy/);
    assert.match(modal, /returnFocusRef/);
  });

  it("DN-LOC-UX-01 contextual modal title uses locationContextName", () => {
    assert.match(modal, /locationContextName/);
    assert.match(modal, /mapModalTitleForLocation/);
    const pointEditor = readSrc("src/ui/components/denali-location-point-editor.tsx");
    assert.match(pointEditor, /locationContextName=\{heading\}/);
  });

  it("DN-LOC-UX-02 stale inline-map copy removed from messages", () => {
    assert.doesNotMatch(faMessages, /mapDeferredHint/);
    assert.doesNotMatch(enMessages, /mapDeferredHint/);
    assert.doesNotMatch(faMessages, /zoneCollapsedHint/);
    assert.doesNotMatch(enMessages, /zoneCollapsedHint/);
    assert.match(faMessages, /zonesHelper/);
    assert.doesNotMatch(faMessages, /نقشه به‌صورت خودکار/);
  });

  it("DN-LOC-UX-03 geolocation error is visible and non-blocking", () => {
    assert.match(modal, /geolocationError/);
    assert.match(modal, /setGeolocationError\(true\)/);
    assert.match(modal, /role="alert"/);
    assert.match(modal, /modal-geolocation-error/);
    assert.match(modal, /clearGeolocationError/);
    assert.match(faMessages, /geolocationError/);
    assert.match(enMessages, /geolocationError/);
  });

  it("DN-LOC-UX-04 mobile scroll structure with sticky footer", () => {
    assert.match(modal, /denali-location-map-modal__scroll/);
    assert.match(css, /\.denali-location-map-modal__scroll/);
    assert.match(css, /overflow-y:\s*auto/);
    assert.match(css, /\.denali-location-map-modal__footer/);
    assert.match(css, /safe-area-inset-bottom/);
    assert.match(css, /flex-shrink:\s*0/);
  });

  it("DN-LOC-UX-05 map interaction hint rendered in modal", () => {
    assert.match(modal, /mapInteractionHint/);
    assert.match(modal, /modal-map-hint/);
  });

  it("DN-LOC-UX-06 clear intent opens modal without inline map", () => {
    assert.match(picker, /openIntent/);
    assert.match(picker, /openModal\("clear"\)/);
    assert.match(modal, /openIntent === "clear"/);
    assert.match(picker, /remove-map/);
    assert.match(picker, /handleCancel/);
    assert.doesNotMatch(picker, /onChange\(.*handleCancel/);
    assert.match(picker, /resolveLocationConfirmPatch\(next\)/);
  });

  it("DN-LOC-UX-06b inline summary hides raw coordinates", () => {
    assert.match(picker, /hasLocationCoordinates/);
    assert.match(picker, /inlineCoordinatesOnly/);
    assert.doesNotMatch(picker, /toFixed/);
  });

  it("DN-LOC-UX-07 Persian coordinate presentation uses toLocalizedDigits", () => {
    assert.match(modal, /toLocalizedDigits/);
    assert.match(modal, /formatCoordinateLabel/);
  });
});
