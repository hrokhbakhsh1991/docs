import assert from "node:assert/strict";
import test from "node:test";

import { AbilityBuilder, createMongoAbility } from "@casl/ability";
import { ForbiddenException } from "@nestjs/common";
import { defineAbilityFor, type AppAbility } from "@repo/shared";

import { TourLifecycleStatus } from "../entities/tour.entity";
import type { CreateTourDto } from "../dto/create-tour.dto";
import type { UpdateTourDto } from "../dto/update-tour.dto";
import {
  assertTourCreateAbilities,
  assertTourPatchAbilities,
} from "./assert-tour-mutation-abilities";

test("leader can patch total_capacity and tripDetails", () => {
  const ability = defineAbilityFor({ id: "u1", role: "leader", status: "ACTIVE" });
  assert.doesNotThrow(() =>
    assertTourPatchAbilities(ability, {
      total_capacity: 10,
      tripDetails: { overview: { title: "x".repeat(12) } },
    } as UpdateTourDto),
  );
});

test("leader can patch lifecycle to OPEN when publish granted", () => {
  const ability = defineAbilityFor({ id: "u1", role: "leader", status: "ACTIVE" });
  assert.doesNotThrow(() =>
    assertTourPatchAbilities(ability, {
      lifecycle_status: TourLifecycleStatus.OPEN,
    } as UpdateTourDto),
  );
});

test("member cannot patch tour at coarse update gate", () => {
  const ability = defineAbilityFor({ id: "u1", role: "member", status: "ACTIVE" });
  try {
    assertTourPatchAbilities(ability, { total_capacity: 5 } as UpdateTourDto);
    assert.fail("expected ForbiddenException");
  } catch (e: unknown) {
    assert.ok(e instanceof ForbiddenException);
    const body = (e as ForbiddenException).getResponse() as { error?: { message?: string } };
    assert.match(body.error?.message ?? "", /tour\.update/);
  }
});

test("actor with update Tour but not TourCore cannot patch total_capacity", () => {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  can("update", "Tour");
  const ability = build();
  try {
    assertTourPatchAbilities(ability, { total_capacity: 5 } as UpdateTourDto);
    assert.fail("expected ForbiddenException");
  } catch (e: unknown) {
    assert.ok(e instanceof ForbiddenException);
    const body = (e as ForbiddenException).getResponse() as { error?: { message?: string } };
    assert.match(body.error?.message ?? "", /tour\.update\.core/);
  }
});

test("actor with update Tour but not TourTripDetails cannot patch tripDetails", () => {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  can("update", "Tour");
  can("update", "TourCore");
  const ability = build();
  try {
    assertTourPatchAbilities(ability, {
      tripDetails: { logistics: { primaryTransportMode: "bus" } },
    } as UpdateTourDto);
    assert.fail("expected ForbiddenException");
  } catch (e: unknown) {
    assert.ok(e instanceof ForbiddenException);
    const body = (e as ForbiddenException).getResponse() as { error?: { message?: string } };
    assert.match(body.error?.message ?? "", /tour\.update\.tripDetails/);
  }
});

test("actor with create Tour but not publish cannot create as OPEN", () => {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  can("create", "Tour");
  const ability = build();
  try {
    assertTourCreateAbilities(ability, {
      title: "1234567890ab",
      total_capacity: 10,
      lifecycle_status: TourLifecycleStatus.OPEN,
    } as CreateTourDto);
    assert.fail("expected ForbiddenException");
  } catch (e: unknown) {
    assert.ok(e instanceof ForbiddenException);
    const body = (e as ForbiddenException).getResponse() as { error?: { message?: string } };
    assert.match(body.error?.message ?? "", /tour\.publish/);
  }
});
