import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDestinationCreateBody,
  buildDestinationPatchBody,
  destinationFormDraftFromResource,
  destinationMetadataFieldsForForm,
  formatDestinationMetadataSummary,
  parseOptionalPositiveFloatField,
  parseOptionalPositiveIntField,
} from "../src/features/settings/destination-form-logic";
import type { DestinationResource } from "../src/features/settings/settings-module-types";

describe("destination-form-logic", () => {
  it("buildDestinationCreateBody includes peak metadata when provided", () => {
    const body = buildDestinationCreateBody({
      regionId: "r1",
      name: "Tochal",
      locationType: "peak",
      altitudeM: "3962",
      typicalTrailDistanceKm: "",
    });
    assert.deepEqual(body, {
      entity: "destination",
      regionId: "r1",
      name: "Tochal",
      locationType: "peak",
      altitudeM: 3962,
    });
  });

  it("rejects invalid altitude input", () => {
    const body = buildDestinationCreateBody({
      regionId: "r1",
      name: "Bad",
      locationType: "peak",
      altitudeM: "-1",
      typicalTrailDistanceKm: "",
    });
    assert.equal(body, null);
  });

  it("buildDestinationPatchBody clears optional metadata with null", () => {
    const body = buildDestinationPatchBody({
      regionId: "r1",
      name: "Trail",
      locationType: "nature_trail",
      altitudeM: "",
      typicalTrailDistanceKm: "",
    });
    assert.deepEqual(body, {
      name: "Trail",
      regionId: "r1",
      locationType: "nature_trail",
      altitudeM: null,
      typicalTrailDistanceKm: null,
    });
  });

  it("parseOptionalPositiveFloatField accepts Persian digits and decimals", () => {
    assert.equal(parseOptionalPositiveFloatField("۶٫۵"), 6.5);
  });

  it("ignores hidden metadata when validating peak create", () => {
    const body = buildDestinationCreateBody({
      regionId: "r1",
      name: "Damavand",
      locationType: "peak",
      altitudeM: "5610",
      typicalTrailDistanceKm: "not-a-number",
    });
    assert.equal(body?.altitudeM, 5610);
    assert.equal(body?.typicalTrailDistanceKm, undefined);
  });

  it("destinationMetadataFieldsForForm returns altitude for peak", () => {
    assert.deepEqual(destinationMetadataFieldsForForm("peak"), ["altitudeM"]);
  });

  it("formatDestinationMetadataSummary formats trail distance km", () => {
    const destination: DestinationResource = {
      id: "d1",
      regionId: "r1",
      name: "Lavasan",
      locationType: "nature_trail",
      altitudeM: null,
      typicalTrailDistanceKm: 5.5,
      isActive: true,
      sortOrder: 0,
    };
    assert.equal(formatDestinationMetadataSummary(destination), "5.5km");
  });

  it("destinationFormDraftFromResource hydrates strings", () => {
    const draft = destinationFormDraftFromResource({
      id: "d1",
      regionId: "r1",
      name: "Damavand",
      locationType: "peak",
      altitudeM: 5610,
      typicalTrailDistanceKm: null,
      isActive: true,
      sortOrder: 0,
    });
    assert.equal(draft.altitudeM, "5610");
    assert.equal(parseOptionalPositiveIntField(draft.altitudeM), 5610);
  });
});
