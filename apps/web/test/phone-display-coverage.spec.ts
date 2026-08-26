import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

describe("phone-display-coverage.spec.ts", () => {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

  it("PHONE-UI-01 users mobile card formats Iranian phone for display", () => {
    const source = readFileSync(
      join(repoRoot, "apps/web/app/(app)/users/users-directory-row-actions-sheet.tsx"),
      "utf8"
    );
    assert.match(source, /formatIranMobileForDisplay\(user\.phone\)/);
  });

  it("PHONE-UI-02 booking inspection formats guestPhone", () => {
    const source = readFileSync(
      join(repoRoot, "apps/web/src/features/bookings/booking-inspection-details.tsx"),
      "utf8"
    );
    assert.match(source, /formatIranMobileForDisplay\(booking\.guestPhone\)/);
  });

  it("PHONE-UI-03 portal member profile BFF formats mobile field", () => {
    const source = readFileSync(
      join(repoRoot, "apps/portal/src/me/member-profile-bff.server.ts"),
      "utf8"
    );
    assert.match(source, /formatIranMobileForDisplay/);
    assert.match(source, /@app-tour\/catalog-registration-auth/);
  });

  it("PHONE-UI-04 users member detail sheet formats phone", () => {
    const source = readFileSync(
      join(repoRoot, "apps/web/app/(app)/users/users-member-detail-sheet.tsx"),
      "utf8"
    );
    assert.match(source, /formatIranMobileForDisplay\(user\.phone\)/);
  });
});
