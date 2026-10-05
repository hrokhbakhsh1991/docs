import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { localizeExposureCatalogFields } from "../src/ui/adapters/localize-exposure-catalog-fields.ts";

describe("localizeExposureCatalogFields (package SoT)", () => {
  it("rewrites adminLabel via resolveDenaliFieldLabel", () => {
    const t = (key: string) => {
      if (key === "fields.title") {
        return "Tour Title FA";
      }
      return key;
    };
    const [localized] = localizeExposureCatalogFields(
      [{ id: "title", canonicalPath: "title", adminLabel: "Tour Title", group: "Basics" }],
      t
    );
    assert.equal(localized?.adminLabel, "Tour Title FA");
    assert.equal(localized?.group, "Basics");
  });

  it("preserves identity when translator yields empty after trim", () => {
    const t = () => "   ";
    const [localized] = localizeExposureCatalogFields(
      [{ id: "x", canonicalPath: "title", adminLabel: "Original" }],
      t
    );
    assert.equal(localized?.adminLabel, "Original");
  });

  it("localizes the location-zones description instead of leaking registry English", () => {
    const t = (key: string) =>
      key === "fields.startPoint" ? "نقطه شروع" :
      key === "fieldDescriptions.locationZones" ? "ناحیه‌های مسیر" : key;
    const [localized] = localizeExposureCatalogFields(
      [{
        id: "denali.location-zones",
        canonicalPath: "denali.location-zones",
        adminLabel: "Location Zones",
        adminDescription: "Start, summit, camp and end location zones.",
      }],
      t,
    );
    assert.equal(localized?.adminDescription, "ناحیه‌های مسیر");
  });

  it("uses the stable field id when the registry canonical path is the wizard path", () => {
    const t = (key: string) =>
      key === "fields.startPoint" ? "نقطه شروع" :
      key === "fieldDescriptions.locationZones" ? "ناحیه‌های مسیر" : key;
    const [localized] = localizeExposureCatalogFields(
      [{
        id: "denali.location-zones",
        canonicalPath: "startPoint",
        adminLabel: "Location Zones",
        adminDescription: "Start, summit, camp and end location zones.",
      }],
      t,
    );
    assert.equal(localized?.adminDescription, "ناحیه‌های مسیر");
  });
});
