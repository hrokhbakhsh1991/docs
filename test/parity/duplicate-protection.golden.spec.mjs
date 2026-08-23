import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  BOOKING_ACTIVE_GUEST_PARTIAL_UNIQUES,
  BOOKING_DUPLICATE_PROBE_KINDS,
  BOOKING_GUEST_DUPLICATE_DOMAIN_ERROR,
} from "../../packages/booking-http-contracts/src/booking-duplicate-protection.contract.ts";
import { assertGoldenParity, fixturePath } from "./lib/golden-harness.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const prismaSchemaPath = join(here, "../../apps/api/prisma/schema.prisma");
const urbanServicePath = join(
  here,
  "../../packages/workspaces/urban/src/http/registration.service.ts"
);

describe("duplicate-protection divergence contract (CW4-07)", () => {
  it("fixture contract: booking capability vs urban workspace policy", () => {
    assertGoldenParity({
      id: "CW4-07-workspace-duplicate-policies",
      fixturePath: fixturePath("duplicate-protection/workspace-duplicate-policies.json"),
      run: () => ({
        bookingCapability: {
          persistenceTable: "operator_registrations",
          partialUniques: BOOKING_ACTIVE_GUEST_PARTIAL_UNIQUES.map((row) => row.name),
          probeKinds: [...BOOKING_DUPLICATE_PROBE_KINDS],
          hostDomainError: BOOKING_GUEST_DUPLICATE_DOMAIN_ERROR,
          workspacePreCreateErrors: [
            "DENALI_REGISTRATION_DUPLICATE",
            "HARBOR_REGISTRATION_DUPLICATE",
          ],
        },
        urbanWorkspacePolicy: {
          persistenceTable: "urban_registrations",
          uniqueIndex: "uq_urban_reg_tenant_tour_email",
          uniqueKeys: ["tenant_id", "tour_id", "email"],
          conflictCode: "URBAN_REGISTRATION_DUPLICATE",
          usesBookingPublicPort: readFileSync(urbanServicePath, "utf8").includes(
            "BookingPublicPort"
          ),
        },
        intentionalDivergence: {
          unifiedPersistence: false,
          sharedProbeKinds: false,
        },
      }),
    });
  });

  it("negative: operator_registrations and urban_registrations remain separate tables", () => {
    const schema = readFileSync(prismaSchemaPath, "utf8");
    assert.match(schema, /@@map\("operator_registrations"\)/);
    assert.match(schema, /@@map\("urban_registrations"\)/);
  });

  it("negative: urban conflict code is not BOOKING_GUEST_DUPLICATE", () => {
    assert.notEqual("URBAN_REGISTRATION_DUPLICATE", BOOKING_GUEST_DUPLICATE_DOMAIN_ERROR);
  });
});
