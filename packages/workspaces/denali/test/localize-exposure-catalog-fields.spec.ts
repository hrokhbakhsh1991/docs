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
});
