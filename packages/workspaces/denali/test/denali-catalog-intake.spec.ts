import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { denaliCatalogIntakeSurface } from "../src/catalog/denali-catalog-intake";

describe("denali-catalog-intake", () => {
  it("DN-INTAKE-01 tour flags gate participant fields before session hide", () => {
    const withoutFlags = denaliCatalogIntakeSurface.resolveEffectiveSchema({
      registrantTarget: "self",
      session: {},
    });
    assert.deepEqual(withoutFlags.fields.map((field) => field.id), ["fullName"]);

    const withFlags = denaliCatalogIntakeSurface.resolveEffectiveSchema({
      registrantTarget: "self",
      session: {},
      tourRequirements: {
        nationalIdRequired: true,
        fatherNameRequired: true,
        birthDateRequired: true,
      },
    });
    assert.deepEqual(withFlags.fields.map((field) => field.id), [
      "fullName",
      "nationalId",
      "fatherName",
      "birthDate",
    ]);
  });

  it("DN-INTAKE-02 session hide applies after tour gate for self", () => {
    const effective = denaliCatalogIntakeSurface.resolveEffectiveSchema({
      registrantTarget: "self",
      session: {
        fullName: "Ada",
        nationalId: "1234567890",
        fatherName: "Bob",
        birthDate: "1990-01-01",
      },
      tourRequirements: {
        nationalIdRequired: true,
        fatherNameRequired: true,
        birthDateRequired: true,
      },
    });
    assert.deepEqual(effective.fields.map((field) => field.id), []);
  });

  it("DN-INTAKE-03 other registrant shows tour-gated fields even when profile has values", () => {
    const effective = denaliCatalogIntakeSurface.resolveEffectiveSchema({
      registrantTarget: "other",
      session: {
        fullName: "Ada",
        nationalId: "1234567890",
        fatherName: "Bob",
        birthDate: "1990-01-01",
      },
      tourRequirements: {
        nationalIdRequired: true,
        fatherNameRequired: true,
        birthDateRequired: true,
      },
    });
    assert.deepEqual(effective.fields.map((field) => field.id), [
      "fullName",
      "phone",
      "nationalId",
      "fatherName",
      "birthDate",
    ]);
  });

  it("DN-INTAKE-04 submit values omit tour-gated fields when flags false", () => {
    const merged = denaliCatalogIntakeSurface.resolveSubmitValues({
      context: {
        registrantTarget: "self",
        session: { fullName: "Ada", nationalId: "1234567890" },
      },
      formValues: { fullName: "", nationalId: "" },
    });
    assert.equal(merged.fullName, "Ada");
    assert.equal(merged.partySize, undefined);
    assert.equal(merged.nationalId, undefined);
  });

  it("DN-INTAKE-05 party size is not an intake field (fixed to 1 by the flow)", () => {
    const schema = denaliCatalogIntakeSurface.schema();
    assert.ok(!schema.fields.some((field) => field.id === "partySize"));
  });
});
