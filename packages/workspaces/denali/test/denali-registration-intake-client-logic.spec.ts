import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  denaliRequiredIntakeCopyField,
  denaliIntakeNationalIdChecksumIssue,
  findDuplicateOtherGuestMobile,
  parseCatalogRegistrationResponseBody,
} from "../src/catalog/registration-flow/denali-registration-intake-client-logic";

describe("denali registration intake client logic", () => {
  it("DN-INTAKE-COPY-01 required nationalId and birthDate are not partySize", () => {
    assert.equal(denaliRequiredIntakeCopyField("nationalId"), "nationalId");
    assert.equal(denaliRequiredIntakeCopyField("birthDate"), "birthDate");
    assert.equal(denaliRequiredIntakeCopyField("fatherName"), "fatherName");
    assert.equal(denaliRequiredIntakeCopyField("unknown"), "partySize");
  });

  it("DN-INTAKE-JSON-01 empty and invalid bodies do not throw", () => {
    assert.equal(parseCatalogRegistrationResponseBody(""), null);
    assert.equal(parseCatalogRegistrationResponseBody("  "), null);
    assert.equal(parseCatalogRegistrationResponseBody("{not-json"), null);
    assert.deepEqual(parseCatalogRegistrationResponseBody('{"ok":true}'), { ok: true });
  });

  it("DN-INTAKE-DUP-01 detects two guest cards with the same IR mobile", () => {
    assert.equal(findDuplicateOtherGuestMobile(["09128003999", "09128003999"]), "+989128003999");
    assert.equal(findDuplicateOtherGuestMobile(["09128003999", "+989128003999"]), "+989128003999");
    assert.equal(findDuplicateOtherGuestMobile(["09128003999", "09128003101"]), null);
  });

  it("DN-INTAKE-NID-01 checksum issue only when field is collected", () => {
    assert.equal(
      denaliIntakeNationalIdChecksumIssue({ fieldInSchema: false, nationalId: "1234567890" }),
      null
    );
    assert.equal(
      denaliIntakeNationalIdChecksumIssue({ fieldInSchema: true, nationalId: "" }),
      null
    );
    assert.equal(
      denaliIntakeNationalIdChecksumIssue({ fieldInSchema: true, nationalId: "0013542419" }),
      null
    );
    assert.equal(
      denaliIntakeNationalIdChecksumIssue({ fieldInSchema: true, nationalId: "1234567890" }),
      "checksum"
    );
  });
});
