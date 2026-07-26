import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDenaliFieldLabel } from "../src/ui/adapters/field-labels.ts";

describe("resolveDenaliFieldLabel composite awareness", () => {
  it("maps composite renderer id to anchor field message", () => {
    const t = (key: string) => {
      if (key === "fields.destinationId") {
        return "Destination";
      }
      return key;
    };
    assert.equal(resolveDenaliFieldLabel(t, "denali.destination"), "Destination");
  });

  it("prefers composite sectionTitle when id is not in the label path map", () => {
    const t = (key: string) => {
      if (key === "composites.fooBar.sectionTitle") {
        return "Foo section";
      }
      return key;
    };
    assert.equal(resolveDenaliFieldLabel(t, "denali.foo-bar"), "Foo section");
  });
});
