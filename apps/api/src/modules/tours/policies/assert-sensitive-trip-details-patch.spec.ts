import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { defineAbilityFor } from "@repo/shared";

import type { UpdateTourDto } from "../dto/update-tour.dto";
import { assertSensitiveTripDetailsPatch } from "./assert-sensitive-trip-details-patch";

describe("assertSensitiveTripDetailsPatch", () => {
  test("member without architect cannot patch pricing slice", () => {
    const ability = defineAbilityFor({
      id: "u1",
      role: "member",
      status: "ACTIVE",
      capabilities: ["tour.update.tripDetails"],
    });
    assert.throws(
      () =>
        assertSensitiveTripDetailsPatch(
          ability,
          { tripDetails: { pricing: { basePrice: 10 } } as UpdateTourDto["tripDetails"] },
          { role: "member", membershipMetadata: { capabilities: ["tour.update.tripDetails"] } },
        ),
      (err: unknown) => err instanceof ForbiddenException,
    );
  });

  test("leader may patch pricing slice", () => {
    const ability = defineAbilityFor({
      id: "u1",
      role: "leader",
      status: "ACTIVE",
    });
    assert.doesNotThrow(() =>
      assertSensitiveTripDetailsPatch(
        ability,
        { tripDetails: { pricing: { basePrice: 10 } } as UpdateTourDto["tripDetails"] },
        { role: "leader" },
      ),
    );
  });
});
