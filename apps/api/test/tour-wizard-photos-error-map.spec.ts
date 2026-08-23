import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { readWizardPhotoDomainErrorCode } from "../src/tours/tour-wizard-photos.routes.ts";

const ROUTE_SOURCE = join(import.meta.dirname, "../src/tours/tour-wizard-photos.routes.ts");

describe("tour-wizard-photos error map", () => {
  it("extracts generic workspace photo error tokens without leaking message details", () => {
    assert.equal(
      readWizardPhotoDomainErrorCode("ALPINE_PHOTO_TENANT_MISMATCH: key=secret"),
      "ALPINE_PHOTO_TENANT_MISMATCH"
    );
    assert.equal(
      readWizardPhotoDomainErrorCode("DENALI_PHOTO_CONTENT_TYPE_INVALID: allowed=image/png"),
      "DENALI_PHOTO_CONTENT_TYPE_INVALID"
    );
  });

  it("keeps the generic route free of Denali-specific photo branches", () => {
    const source = readFileSync(ROUTE_SOURCE, "utf8");

    assert.match(source, /readWizardPhotoDomainErrorCode/);
    assert.doesNotMatch(source, /startsWith\("DENALI_PHOTO_"\)/);
    assert.doesNotMatch(source, /code:\s*message/);
  });
});
