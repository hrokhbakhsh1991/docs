import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { withTenantRls } from "../../db/with-tenant-rls";
import { getBackgroundAdminClient, BACKGROUND_ADMIN_REASON } from "../../db/background-admin-client";
import { disconnectPrisma } from "../../db/prisma";
import { putIntegrationSecretInTransaction } from "../infrastructure/integration-secret-store";
import { seedDefaultEventPoliciesForConnectionInTransaction } from "../infrastructure/prisma-integration-policy.repository";
import {
  buildTelegramBackfillPlanItem,
  detectTelegramBackfillMismatches,
  type LegacyTelegramBotSnapshot,
  type TelegramBackfillMismatch,
  type TelegramBackfillPlanItem,
} from "./telegram-backfill-plan";

export type RunTelegramBackfillOptions = {
  readonly tenantId?: string;
  readonly dryRun: boolean;
  readonly migratedAtIso?: string;
};

export type RunTelegramBackfillResult = {
  readonly mode: "dry-run" | "apply";
  readonly planned: readonly TelegramBackfillPlanItem[];
  readonly applied: readonly TelegramBackfillPlanItem[];
  readonly skipped: readonly TelegramBackfillPlanItem[];
};

export type VerifyTelegramBackfillResult = {
  readonly scanned: number;
  readonly mismatches: readonly TelegramBackfillMismatch[];
};

async function listLegacyCandidates(tenantId?: string): Promise<LegacyTelegramBotSnapshot[]> {
  const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_INTEGRATION_MIGRATION);
  const rows = await admin.workspaceTelegramBot.findMany({
    where: tenantId !== undefined ? { tenantId } : undefined,
    orderBy: [{ tenantId: "asc" }, { workspaceType: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    tenantId: row.tenantId,
    workspaceType: row.workspaceType,
    channelId: row.channelId,
    enabled: row.enabled,
    botToken: row.botToken,
    createdByUserId: row.createdByUserId,
  }));
}

async function findExistingTelegramConnection(
  tenantId: string,
  workspaceType: string
): Promise<{ readonly id: string } | null> {
  return withTenantRls(tenantId, async (tx) => {
    const row = await tx.integrationConnection.findFirst({
      where: {
        tenantId,
        provider: "telegram",
        workspaceType,
      },
      select: { id: true },
    });
    return row;
  });
}

async function planForLegacy(
  legacy: LegacyTelegramBotSnapshot,
  migratedAtIso: string
): Promise<TelegramBackfillPlanItem> {
  const existing = await findExistingTelegramConnection(legacy.tenantId, legacy.workspaceType);
  return buildTelegramBackfillPlanItem({
    legacy,
    existingConnection: existing,
    connectionId: randomUUID(),
    migratedAtIso,
  });
}

async function applyPlanItem(
  legacy: LegacyTelegramBotSnapshot,
  plan: TelegramBackfillPlanItem
): Promise<void> {
  if (plan.action !== "insert" || plan.proposed === undefined) {
    return;
  }

  const proposed = plan.proposed;
  await withTenantRls(legacy.tenantId, async (tx) => {
    const existing = await tx.integrationConnection.findFirst({
      where: {
        tenantId: legacy.tenantId,
        provider: "telegram",
        workspaceType: legacy.workspaceType,
      },
      select: { id: true },
    });
    if (existing !== null) {
      return;
    }

    await tx.integrationConnection.create({
      data: {
        id: proposed.connectionId,
        tenantId: legacy.tenantId,
        workspaceType: legacy.workspaceType,
        provider: proposed.provider,
        status: proposed.status,
        enabled: proposed.enabled,
        capabilities: proposed.capabilities as Prisma.InputJsonValue,
        config: proposed.config as Prisma.InputJsonValue,
        credentials: {},
        secretRef: proposed.secretRef,
        createdByUserId: legacy.createdByUserId,
      },
    });

    if (
      proposed.secretStrategy === "integration_secret_store" &&
      proposed.secretRef !== null &&
      legacy.botToken.trim().length > 0
    ) {
      await putIntegrationSecretInTransaction(tx, legacy.tenantId, proposed.secretRef, {
        botToken: legacy.botToken.trim(),
      });
    }

    await seedDefaultEventPoliciesForConnectionInTransaction(tx, {
      tenantId: legacy.tenantId,
      integrationConnectionId: proposed.connectionId,
      provider: "telegram",
      workspaceType: legacy.workspaceType,
    });
  });
}

function logPlanLine(tag: string, plan: TelegramBackfillPlanItem): void {
  console.log(
    tag,
    JSON.stringify({
      action: plan.action,
      reason: plan.reason,
      tenantId: plan.tenantId,
      workspaceType: plan.workspaceType,
      legacyBotId: plan.legacyBotId,
      proposed: plan.proposed,
    })
  );
}

export async function runTelegramBackfill(
  options: RunTelegramBackfillOptions
): Promise<RunTelegramBackfillResult> {
  const migratedAtIso = options.migratedAtIso ?? new Date().toISOString();
  const legacyRows = await listLegacyCandidates(options.tenantId);
  const planned: TelegramBackfillPlanItem[] = [];
  const applied: TelegramBackfillPlanItem[] = [];
  const skipped: TelegramBackfillPlanItem[] = [];

  for (const legacy of legacyRows) {
    const plan = await planForLegacy(legacy, migratedAtIso);
    planned.push(plan);

    if (plan.action === "insert") {
      if (options.dryRun) {
        logPlanLine("TELEGRAM_BACKFILL_DRY_RUN", plan);
      } else {
        await applyPlanItem(legacy, plan);
        logPlanLine("TELEGRAM_BACKFILL_APPLIED", plan);
        applied.push(plan);
      }
    } else {
      logPlanLine("TELEGRAM_BACKFILL_SKIP", plan);
      skipped.push(plan);
    }
  }

  return {
    mode: options.dryRun ? "dry-run" : "apply",
    planned,
    applied,
    skipped,
  };
}

export async function verifyTelegramBackfill(
  tenantId?: string
): Promise<VerifyTelegramBackfillResult> {
  const legacyRows = await listLegacyCandidates(tenantId);
  const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_INTEGRATION_MIGRATION);
  const connectionRows = await admin.integrationConnection.findMany({
    where: {
      provider: "telegram",
      ...(tenantId !== undefined ? { tenantId } : {}),
    },
  });

  const scopes = new Map<string, LegacyTelegramBotSnapshot | null>();
  for (const legacy of legacyRows) {
    scopes.set(`${legacy.tenantId}:${legacy.workspaceType}`, legacy);
  }
  for (const connection of connectionRows) {
    const workspaceType = connection.workspaceType ?? "";
    const key = `${connection.tenantId}:${workspaceType}`;
    if (!scopes.has(key)) {
      scopes.set(key, null);
    }
  }

  const mismatches: TelegramBackfillMismatch[] = [];

  for (const [key, legacy] of scopes) {
    const separatorIndex = key.indexOf(":");
    if (separatorIndex <= 0) {
      continue;
    }
    const rowTenantId = key.slice(0, separatorIndex);
    const workspaceType = key.slice(separatorIndex + 1);

    const connections = await withTenantRls(rowTenantId, async (tx) => {
      const rows = await tx.integrationConnection.findMany({
        where: {
          tenantId: rowTenantId,
          provider: "telegram",
          workspaceType,
        },
      });
      const enriched = [];
      for (const row of rows) {
        let hasSecretPayload = false;
        if (row.secretRef !== null) {
          const secret = await tx.integrationSecret.findUnique({
            where: { secretRef: row.secretRef },
          });
          hasSecretPayload = secret !== null;
        }
        enriched.push({
          id: row.id,
          tenantId: row.tenantId,
          workspaceType: row.workspaceType,
          provider: row.provider,
          status: row.status,
          enabled: row.enabled,
          config:
            typeof row.config === "object" && row.config !== null
              ? (row.config as Record<string, unknown>)
              : {},
          secretRef: row.secretRef,
          hasSecretPayload,
        });
      }
      return enriched;
    });

    mismatches.push(
      ...detectTelegramBackfillMismatches({
        legacy,
        connections,
      })
    );
  }

  return {
    scanned: scopes.size,
    mismatches,
  };
}

export async function runTelegramBackfillCli(argv: readonly string[]): Promise<void> {
  const tenantId = readArg(argv, "tenant");
  const dryRun = !argv.includes("--apply");
  const verifyOnly = argv.includes("--verify");

  try {
    if (verifyOnly) {
      const result = await verifyTelegramBackfill(tenantId);
      console.log(
        "TELEGRAM_BACKFILL_VERIFY",
        JSON.stringify({
          scanned: result.scanned,
          mismatchCount: result.mismatches.length,
          mismatches: result.mismatches,
        })
      );
      if (result.mismatches.length > 0) {
        process.exitCode = 2;
      }
      return;
    }

    const result = await runTelegramBackfill({ tenantId, dryRun });
    console.log(
      "TELEGRAM_BACKFILL_SUMMARY",
      JSON.stringify({
        mode: result.mode,
        planned: result.planned.length,
        applied: result.applied.length,
        skipped: result.skipped.length,
        inserts: result.planned.filter((item) => item.action === "insert").length,
      })
    );
  } finally {
    await disconnectPrisma();
  }
}

function readArg(argv: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  for (const arg of argv) {
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length).trim();
    }
  }
  return undefined;
}
