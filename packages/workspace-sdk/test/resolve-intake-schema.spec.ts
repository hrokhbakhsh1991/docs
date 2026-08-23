import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import {
  clearWorkspaceIntakePluginRegistryForTests,
  registerWorkspaceIntakePlugin,
} from "../src/catalog/workspace-intake-plugin-registry";
import {
  resolveEffectiveIntakeSchema,
  resolveIntakeSchema,
  resolveIntakeSubmitValues,
  validateIntakeSchemaValues,
} from "../src/catalog/resolve-intake-schema";
import {
  denaliCatalogIntakeFixture,
  urbanCatalogIntakeFixture,
} from "./fixtures/catalog-intake-plugins";

function bootstrapIntakePluginsForTests(): void {
  clearWorkspaceIntakePluginRegistryForTests();
  registerWorkspaceIntakePlugin({
    id: "denali",
    catalogIntake: denaliCatalogIntakeFixture,
  });
  registerWorkspaceIntakePlugin({
    id: "urban",
    catalogIntake: urbanCatalogIntakeFixture,
  });
}

describe("resolve-intake-schema (registry)", () => {
  before(() => {
    bootstrapIntakePluginsForTests();
  });

  it("SDK-SCH-01 denali plugin schema maps participant profile fields", () => {
    const schema = resolveIntakeSchema("denali");
    assert.deepEqual(
      schema.fields.map((field) => field.id),
      ["fullName", "phone", "nationalId", "fatherName", "birthDate"]
    );
    assert.equal(schema.fields.find((field) => field.id === "birthDate")?.type, "date");
    assert.equal(schema.features.transportIntake, true);
  });

  it("SDK-SCH-02 urban plugin schema maps email intake", () => {
    const schema = resolveIntakeSchema("urban");
    assert.deepEqual(
      schema.fields.map((field) => field.id),
      ["fullName", "partySize", "email", "notes"]
    );
    assert.equal(schema.features.notesAtIntake, true);
    assert.equal(schema.features.successDataAttributes?.["data-urban-registration-success"], true);
  });

  it("SDK-SCH-04 effective schema hides session-known self fields", () => {
    const effective = resolveEffectiveIntakeSchema("denali", {
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
    assert.deepEqual(
      effective.fields.map((field) => field.id),
      []
    );
  });

  it("SDK-SCH-04b effective schema omits participant fields when tour flags false", () => {
    const effective = resolveEffectiveIntakeSchema("denali", {
      registrantTarget: "self",
      session: {},
    });
    assert.deepEqual(
      effective.fields.map((field) => field.id),
      ["fullName"]
    );
  });

  it("SDK-SCH-05 submit values merge session fallbacks for hidden fields", () => {
    const merged = resolveIntakeSubmitValues({
      pluginId: "denali",
      context: {
        registrantTarget: "self",
        session: {
          fullName: "Ada",
          nationalId: "1234567890",
        },
        tourRequirements: { nationalIdRequired: true },
      },
      formValues: {
        fullName: "",
        nationalId: "",
      },
    });
    assert.equal(merged.fullName, "Ada");
    assert.equal(merged.nationalId, "1234567890");
    assert.equal(merged.partySize, undefined);
  });

  it("SDK-SCH-06 validateIntakeSchemaValues enforces field rules", () => {
    const schema = resolveIntakeSchema("denali");
    const issues = validateIntakeSchemaValues(schema, {
      fullName: "Ada",
      phone: "09123456789",
      nationalId: "abc",
      fatherName: "Bob",
      birthDate: "1990-01-01",
      partySize: "2",
    });
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.fieldId, "nationalId");
    assert.equal(issues[0]?.code, "pattern");
  });
});
