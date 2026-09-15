import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("denali-wizard-map-experience (INV-DENALI-WIZ-MAP-01)", () => {
  it("DN-MAP-UX-01 wraps picker with preview + expanded dialog shell", () => {
    const experience = readFileSync(
      join(root, "src/ui/components/map/denali-wizard-map-experience.tsx"),
      "utf8"
    );
    assert.match(experience, /interactionMode="preview"/);
    assert.match(experience, /interactionMode="expanded"/);
    assert.match(experience, /<dialog/);
    assert.match(experience, /showModal\(\)/);
    assert.match(experience, /data-testid=\{`denali-wizard-map-open-\$\{testIdKey\}`\}/);
    assert.match(experience, /data-testid=\{`denali-wizard-map-close-\$\{testIdKey\}`\}/);
    assert.match(experience, /expandedMounted/);
  });

  it("DN-MAP-UX-02 address picker delegates map rendering to wizard map experience", () => {
    const picker = readFileSync(
      join(root, "src/ui/components/denali-location-address-picker.tsx"),
      "utf8"
    );
    assert.match(picker, /DenaliWizardMapExperience/);
    assert.doesNotMatch(picker, /<DenaliLocationPickerMap/);
    assert.match(picker, /deferred=\{!mapMounted\}/);
  });

  it("DN-MAP-UX-03 preview mode disables map gestures in inner picker", () => {
    const inner = readFileSync(
      join(root, "src/ui/components/map/denali-location-picker-map-inner.tsx"),
      "utf8"
    );
    assert.match(inner, /interactionMode === "expanded"/);
    assert.match(inner, /scrollWheelZoom: isInteractive/);
    assert.match(inner, /dragging: isInteractive/);
    assert.match(inner, /data-wizard-map-interaction/);
    assert.match(inner, /invalidateSize/);
  });

  it("DN-MAP-UX-04 wizard theme styles preview overlay and fullscreen dialog", () => {
    const css = readFileSync(join(root, "theme/wizard-fields.css"), "utf8");
    assert.match(css, /\.denali-wizard-map-experience__preview/);
    assert.match(css, /\.denali-wizard-map-experience__open/);
    assert.match(css, /\.denali-wizard-map-dialog\[open\]/);
    assert.match(css, /\.denali-wizard-map-dialog:not\(\[open\]\)/);
    assert.match(css, /100dvh/);
    assert.match(css, /data-wizard-map-interaction="preview"/);
  });
});
