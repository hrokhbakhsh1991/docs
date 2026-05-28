import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { UnauthorizedException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { AuthController } from "../../src/modules/auth/auth.controller";
import { AuthorizationPresenceGuard } from "../../src/modules/auth/authorization-presence.guard";
import { RolesGuard } from "../../src/modules/auth/roles.guard";
import { AbilitiesGuard } from "../../src/common/casl/abilities.guard";
import { CaslMirrorAbilitiesGuard } from "../../src/common/casl/casl-mirror-abilities.guard";
import { UserRole } from "../../src/common/auth/user-role.enum";
import { ROLES_METADATA_KEY } from "../../src/modules/auth/roles.decorator";
import { LinkTelegramDto } from "../../src/modules/auth/dto/link-telegram.dto";

test("link-telegram declares JWT + role + CASL mirror guard chain", () => {
  const guards = Reflect.getMetadata(
    GUARDS_METADATA,
    AuthController.prototype.linkTelegram
  ) as Array<new (..._args: unknown[]) => unknown>;
  assert.equal(Array.isArray(guards), true);
  assert.equal(guards.includes(AuthorizationPresenceGuard), true);
  assert.equal(guards.includes(RolesGuard as never), true);
  assert.equal(guards.includes(AbilitiesGuard as never), true);
  assert.equal(guards.includes(CaslMirrorAbilitiesGuard as never), true);

  const roles = Reflect.getMetadata(
    ROLES_METADATA_KEY,
    AuthController.prototype.linkTelegram
  ) as UserRole[];
  assert.deepEqual(
    roles,
    [UserRole.Member, UserRole.Owner, UserRole.Admin, UserRole.Leader, UserRole.Viewer]
  );
});

test("link-telegram is fail-closed when request context lacks identity", async () => {
  const controller = new AuthController(
    { linkTelegram: async () => ({}) } as never,
    { listWorkspaces: async () => [] } as never,
    { getMembershipAbilityContext: async () => ({ labels: [], capabilities: [] }) } as never,
    {
      getUserId: () => undefined,
      resolveEffectiveTenantId: () => undefined,
      getTenantId: () => undefined
    } as never,
    { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as never
  );

  await assert.rejects(
    () =>
      controller.linkTelegram({
        telegram_init_payload: "payload"
      } as LinkTelegramDto),
    (error: unknown) => error instanceof UnauthorizedException
  );
});

test("link-telegram succeeds for authorized caller with explicit identity context", async () => {
  const controller = new AuthController(
    {
      linkTelegram: async () => ({
        user_id: "user-1",
        linked_telegram_user_id: "777777",
        link_status: "Linked" as const,
        linked_at: "2026-01-01T00:00:00.000Z"
      })
    } as never,
    { listWorkspaces: async () => [] } as never,
    { getMembershipAbilityContext: async () => ({ labels: [], capabilities: [] }) } as never,
    {
      getUserId: () => "user-1",
      resolveEffectiveTenantId: () => "tenant-1",
      getTenantId: () => "tenant-1"
    } as never,
    { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as never
  );

  const result = await controller.linkTelegram({
    telegram_init_payload: "payload"
  } as LinkTelegramDto);
  assert.equal(result.link_status, "Linked");
  assert.equal(result.user_id, "user-1");
});
