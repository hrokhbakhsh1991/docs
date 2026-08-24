import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DENALI_FIELD_DEFINITIONS } from "../src/field-registry/denaliFieldRegistryData";
import {
  DENALI_TRANSPORT_MODE_CANONICAL_PATH,
  denaliTransportFieldModule,
} from "../src/field-registry/denali-transport-tour-field-module";

describe("denali-transport-pipeline-parity.golden.spec (CW7-07)", () => {
  it("tour-field module matches denaliFieldRegistryData transport.mode row", () => {
    const transportRow = DENALI_FIELD_DEFINITIONS.find(
      (row) => row.canonicalPath === DENALI_TRANSPORT_MODE_CANONICAL_PATH
    );
    assert.ok(transportRow);

    const fragmentField = denaliTransportFieldModule.fields[0];
    assert.equal(fragmentField.canonicalPath, transportRow.canonicalPath);
    assert.equal(fragmentField.stepId, transportRow.stepId);
    assert.equal(fragmentField.rhfPath, transportRow.rhfPath);
    assert.equal(fragmentField.zodPath, transportRow.zodPath);
    assert.equal(fragmentField.zodKind, transportRow.zodKind);
    assert.deepEqual(fragmentField.tags, transportRow.tags);
    assert.deepEqual(fragmentField.ruleDefaults, transportRow.ruleDefaults);
  });

  it("field module exposes workspaceTransport.tourField id with mode + dependents", () => {
    assert.equal(denaliTransportFieldModule.moduleId, "workspaceTransport.tourField");
    assert.equal(denaliTransportFieldModule.fields.length, 7);
    assert.equal(denaliTransportFieldModule.fields[0]?.canonicalPath, DENALI_TRANSPORT_MODE_CANONICAL_PATH);
  });
});
