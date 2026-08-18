import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_TENANT_HOST_RESERVED_LABELS,
  isLegacyClubAdminHost,
  toCanonicalClubAdminHost,
} from "../src/index";

const reserved = new Set(DEFAULT_TENANT_HOST_RESERVED_LABELS);

describe("toCanonicalClubAdminHost — WRS-ADMIN-LEGACY-308", () => {
  it("WRS-ADM-CAN-01 legacy club admin rewrites to inverted localhost", () => {
    assert.equal(
      toCanonicalClubAdminHost("denali.admin.localhost:3000", "localhost", reserved),
      "admin.denali.localhost:3000"
    );
  });

  it("WRS-ADM-CAN-02 bare legacy host without port", () => {
    assert.equal(
      toCanonicalClubAdminHost("operator.admin.localhost", "localhost", reserved),
      "admin.operator.localhost"
    );
  });

  it("WRS-ADM-CAN-03 canonical host is not rewritten", () => {
    assert.equal(
      toCanonicalClubAdminHost("admin.denali.localhost:3000", "localhost", reserved),
      null
    );
  });

  it("WRS-ADM-CAN-04 fail-closed on non-admin hosts", () => {
    assert.equal(toCanonicalClubAdminHost("", "localhost", reserved), null);
    assert.equal(toCanonicalClubAdminHost("   ", "localhost", reserved), null);
    assert.equal(toCanonicalClubAdminHost("not-an-admin-host.localhost", "localhost", reserved), null);
    assert.equal(toCanonicalClubAdminHost("denali.localhost:3000", "localhost", reserved), null);
  });

  it("WRS-ADM-CAN-05 non-localhost root is not rewritten", () => {
    assert.equal(
      toCanonicalClubAdminHost("denali.admin.example.com:3000", "example.com", reserved),
      null
    );
    assert.equal(
      toCanonicalClubAdminHost("denali.admin.localhost:3000", "example.com", reserved),
      null
    );
  });

  it("WRS-ADM-CAN-06 platform admin host is not rewritten", () => {
    assert.equal(toCanonicalClubAdminHost("admin.localhost:3000", "localhost", reserved), null);
    assert.equal(toCanonicalClubAdminHost("admin.portal.localhost:3000", "localhost", reserved), null);
  });
});

describe("isLegacyClubAdminHost", () => {
  it("detects legacy shape only", () => {
    assert.equal(isLegacyClubAdminHost("denali.admin.localhost:3000", "localhost", reserved), true);
    assert.equal(isLegacyClubAdminHost("admin.denali.localhost:3000", "localhost", reserved), false);
  });
});
