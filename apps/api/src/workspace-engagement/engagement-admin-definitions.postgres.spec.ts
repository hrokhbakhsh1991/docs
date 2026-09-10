/**
 * MEG-001 — operator-managed engagement definitions (Postgres + RLS).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { disconnectPrisma, getPrismaAdmin } from "../db/prisma";
import { runWithTenantContext } from "../tenant/tenant-request-context";
import { integrationTenantId } from "../../test/test-helpers";
import { createEngagementAdminOperations, requireOperatorMutate } from "./engagement-admin-operations";
import { createPrismaEngagementDefinitionsRepository } from "./infrastructure/prisma-engagement-definitions.repository";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) &&
  Boolean(process.env.DATABASE_URL_ADMIN?.trim());
const postgresSkip = !hasDatabase ? "ENGAGEMENT_ADMIN_REQUIRES_DATABASE" : false;

describe(
  "engagement-admin-definitions.postgres.spec.ts — MEG-001",
  { skip: postgresSkip, concurrency: false },
  () => {
    const tenantId = integrationTenantId();
    const ownerId = randomUUID();
    const viewerId = randomUUID();
    const workspaceId = "denali";
    const definitionsRepo = createPrismaEngagementDefinitionsRepository();

    before(async () => {
      const admin = getPrismaAdmin();
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `eng-admin-${tenantId.slice(0, 8)}`,
          workspaceType: "denali",
          theme: {},
        },
      });
    });

    after(async () => {
      const admin = getPrismaAdmin();
      await admin.$executeRawUnsafe(
        "TRUNCATE engagement_definition_audit_logs, engagement_award_rule_definitions, engagement_level_definitions, engagement_badge_definitions",
      );
      await admin.tenant.delete({ where: { id: tenantId } });
      await disconnectPrisma();
    });

    it("seeds defaults and allows owner badge CRUD with audit trail", async () => {
      await runWithTenantContext(tenantId, async () => {
        await definitionsRepo.ensureSeeded(tenantId, workspaceId);
        const adminOps = createEngagementAdminOperations(async () => workspaceId);
        const created = await adminOps.createOperatorBadge(
          { tenantId, userId: ownerId, role: "owner", workspaceId: "ws" },
          {
            code: "summit_star",
            titleI18n: { en: "Summit Star", fa: "ستاره قله" },
            descriptionI18n: { en: "Custom badge", fa: "نشان سفارشی" },
            iconKey: "star",
            triggerKind: "points_threshold",
            triggerMinPoints: 75,
          },
        );
        assert.equal(created.code, "summit_star");
        const activated = await adminOps.updateOperatorBadge(
          { tenantId, userId: ownerId, role: "owner", workspaceId: "ws" },
          "summit_star",
          { rowVersion: created.rowVersion, status: "active" },
        );
        assert.equal(activated.status, "active");
        const audit = await adminOps.listOperatorAuditLog(
          { tenantId, userId: ownerId, role: "owner", workspaceId: "ws" },
          20,
        );
        assert.ok(audit.items.length >= 2);
      });
    });

    it("denies viewer mutations", () => {
      assert.throws(
        () =>
          requireOperatorMutate({
            tenantId,
            userId: viewerId,
            role: "viewer",
            workspaceId: "ws",
          }),
        /FORBIDDEN_ENGAGEMENT_OPERATOR/,
      );
    });

    it("rejects unsupported award rule event types at service layer", async () => {
      await runWithTenantContext(tenantId, async () => {
        const adminOps = createEngagementAdminOperations(async () => workspaceId);
        await assert.rejects(
          () =>
            adminOps.createOperatorAwardRule(
              { tenantId, userId: ownerId, role: "owner", workspaceId: "ws" },
              {
                eventType: "wallet.credit" as "profile.completed",
                points: 10,
              },
            ),
          /ENGAGEMENT_AWARD_EVENT_UNSUPPORTED/,
        );
      });
    });

    it("enforces level threshold uniqueness among active levels", async () => {
      await runWithTenantContext(tenantId, async () => {
        await definitionsRepo.ensureSeeded(tenantId, workspaceId);
        await assert.rejects(
          () =>
            definitionsRepo.createLevel(tenantId, workspaceId, {
              code: "duplicate_threshold",
              titleI18n: { en: "Dup", fa: "تکراری" },
              descriptionI18n: { en: "Dup", fa: "تکراری" },
              minPoints: 0,
              status: "active",
            }),
          /level threshold conflict/,
        );
      });
    });
  },
);
