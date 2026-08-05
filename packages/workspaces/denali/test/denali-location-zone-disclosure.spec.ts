import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  isDenaliLocationDataPopulated,
  parseDenaliLocationData,
} from "../src/ui/logic/denali-location-types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("denali-location-zone-disclosure (INV-DENALI-WIZ-019)", () => {
  it("DN-LOC-ZONE-01 treats empty objects as not populated", () => {
    assert.equal(isDenaliLocationDataPopulated({}), false);
    assert.equal(isDenaliLocationDataPopulated(parseDenaliLocationData(null)), false);
    assert.equal(isDenaliLocationDataPopulated(parseDenaliLocationData({ label: "  " })), false);
  });

  it("DN-LOC-ZONE-02 detects label, address, or coordinates", () => {
    assert.equal(isDenaliLocationDataPopulated({ label: "Base" }), true);
    assert.equal(isDenaliLocationDataPopulated({ address: "Tehran" }), true);
    assert.equal(
      isDenaliLocationDataPopulated({ latitude: 35.7, longitude: 51.4 }),
      true
    );
    assert.equal(isDenaliLocationDataPopulated({ latitude: 35.7 }), false);
  });

  it("DN-LOC-ZONE-03 point editor defaults closed when empty and defers map", () => {
    const editor = readFileSync(
      join(root, "src/ui/components/denali-location-point-editor.tsx"),
      "utf8"
    );
    assert.match(editor, /isDenaliLocationDataPopulated/);
    assert.match(editor, /mapMounted=\{open\}/);
    assert.match(editor, /data-location-zone-open/);
    assert.match(editor, /open=\{open\}/);
    assert.doesNotMatch(editor, /<details[^>]*\sopen>/);

    const picker = readFileSync(
      join(root, "src/ui/components/denali-location-address-picker.tsx"),
      "utf8"
    );
    assert.match(picker, /mapMounted/);
    assert.match(picker, /map-deferred/);
    assert.match(picker, /DenaliLocationPickerMap/);
  });
});
