import type { Prisma } from "@prisma/client";
import { sanitizeTicketTemplateBody, type TicketTemplateChannel, type TicketTemplateLocale } from "@app-tour/ticketing-core";

import { withTenantRls } from "../db/with-tenant-rls";
import { isPrismaUniqueConstraintError } from "../db/prisma-error-instance";
import { toIso } from "./ticketing-mappers";
import {
  resolveTicketingDefaultTemplates,
  type TicketingDefaultTemplateSeed,
} from "./ticketing-default-templates";
import { resolveTicketingTenantWorkspaceRow } from "./resolve-ticketing-workspace-type-for-tenant";

export type TicketTemplateRecord = {
  readonly id: string;
  readonly tenantId: string;
  readonly code: string;
  readonly title: string;
  readonly body: string;
  readonly channel: TicketTemplateChannel;
  readonly locale: TicketTemplateLocale;
  readonly enabled: boolean;
  readonly version: number;
  readonly workspaceType: string | null;
  readonly isSystemDefault: boolean;
  readonly archivedAt: string | null;
  readonly rowVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

function mapRow(row: {
  id: string;
  tenantId: string;
  code: string;
  title: string;
  body: string;
  channel: string;
  locale: string;
  enabled: boolean;
  version: number;
  workspaceType: string | null;
  isSystemDefault: boolean;
  archivedAt: Date | null;
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
}): TicketTemplateRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    code: row.code,
    title: row.title,
    body: row.body,
    channel: row.channel as TicketTemplateChannel,
    locale: row.locale as TicketTemplateLocale,
    enabled: row.enabled,
    version: row.version,
    workspaceType: row.workspaceType,
    isSystemDefault: row.isSystemDefault,
    archivedAt: row.archivedAt ? toIso(row.archivedAt) : null,
    rowVersion: row.rowVersion,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

export function toTicketTemplateHttp(record: TicketTemplateRecord): Record<string, unknown> {
  return {
    id: record.id,
    code: record.code,
    title: record.title,
    body: record.body,
    channel: record.channel,
    locale: record.locale,
    enabled: record.enabled,
    version: record.version,
    workspaceType: record.workspaceType,
    isSystemDefault: record.isSystemDefault,
    rowVersion: record.rowVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function insertRevision(
  tx: Prisma.TransactionClient,
  input: {
    readonly tenantId: string;
    readonly templateId: string;
    readonly version: number;
    readonly title: string;
    readonly body: string;
    readonly channel: string;
    readonly locale: string;
    readonly enabled: boolean;
    readonly createdByUserId?: string | null;
  },
): Promise<void> {
  await tx.ticketTemplateRevision.create({
    data: {
      tenantId: input.tenantId,
      templateId: input.templateId,
      version: input.version,
      title: input.title,
      body: input.body,
      channel: input.channel,
      locale: input.locale,
      enabled: input.enabled,
      createdByUserId: input.createdByUserId ?? null,
    },
  });
}

export async function ensureDefaultTicketTemplatesForTenant(tenantId: string): Promise<void> {
  const workspace = await resolveTicketingTenantWorkspaceRow(tenantId);
  if (workspace === null) return;
  const seeds = resolveTicketingDefaultTemplates(workspace.workspaceType);
  if (seeds.length === 0) return;

  await withTenantRls(tenantId, async (tx) => {
    for (const seed of seeds) {
      await tx.ticketTemplate.upsert({
        where: {
          tenantId_code_channel_locale: {
            tenantId,
            code: seed.code,
            channel: seed.channel,
            locale: seed.locale,
          },
        },
        create: {
          tenantId,
          code: seed.code,
          title: seed.title,
          body: sanitizeTicketTemplateBody(seed.body),
          channel: seed.channel,
          locale: seed.locale,
          enabled: seed.enabled ?? true,
          workspaceType: workspace.workspaceType,
          isSystemDefault: true,
          version: 1,
        },
        update: {},
      });
    }
  });
}

export async function listTicketTemplates(
  tenantId: string,
  filter?: { readonly channel?: TicketTemplateChannel; readonly locale?: TicketTemplateLocale },
): Promise<readonly TicketTemplateRecord[]> {
  await ensureDefaultTicketTemplatesForTenant(tenantId);
  return withTenantRls(tenantId, async (tx) => {
    const rows = await tx.ticketTemplate.findMany({
      where: {
        tenantId,
        archivedAt: null,
        ...(filter?.channel !== undefined ? { channel: filter.channel } : {}),
        ...(filter?.locale !== undefined ? { locale: filter.locale } : {}),
      },
      orderBy: [{ code: "asc" }, { channel: "asc" }, { locale: "asc" }],
    });
    return rows.map(mapRow);
  });
}

export async function findTicketTemplate(
  tenantId: string,
  code: string,
  channel: TicketTemplateChannel,
  locale: TicketTemplateLocale,
): Promise<TicketTemplateRecord | null> {
  return withTenantRls(tenantId, async (tx) => {
    const row = await tx.ticketTemplate.findFirst({
      where: { tenantId, code, channel, locale, archivedAt: null },
    });
    return row === null ? null : mapRow(row);
  });
}

export async function createTicketTemplate(
  tenantId: string,
  input: {
    readonly code: string;
    readonly title: string;
    readonly body: string;
    readonly channel: TicketTemplateChannel;
    readonly locale: TicketTemplateLocale;
    readonly enabled?: boolean;
    readonly workspaceType?: string | null;
    readonly createdByUserId?: string | null;
  },
): Promise<TicketTemplateRecord> {
  const body = sanitizeTicketTemplateBody(input.body);
  return withTenantRls(tenantId, async (tx) => {
    const row = await tx.ticketTemplate.create({
      data: {
        tenantId,
        code: input.code,
        title: input.title,
        body,
        channel: input.channel,
        locale: input.locale,
        enabled: input.enabled ?? true,
        workspaceType: input.workspaceType ?? null,
        isSystemDefault: false,
        version: 1,
      },
    });
    await insertRevision(tx, {
      tenantId,
      templateId: row.id,
      version: 1,
      title: row.title,
      body: row.body,
      channel: row.channel,
      locale: row.locale,
      enabled: row.enabled,
      createdByUserId: input.createdByUserId ?? null,
    });
    return mapRow(row);
  });
}

export async function updateTicketTemplate(
  tenantId: string,
  code: string,
  channel: TicketTemplateChannel,
  locale: TicketTemplateLocale,
  input: {
    readonly title?: string;
    readonly body?: string;
    readonly enabled?: boolean;
    readonly rowVersion: number;
    readonly updatedByUserId?: string | null;
  },
): Promise<TicketTemplateRecord | null> {
  return withTenantRls(tenantId, async (tx) => {
    const existing = await tx.ticketTemplate.findFirst({
      where: { tenantId, code, channel, locale, archivedAt: null },
    });
    if (existing === null || existing.rowVersion !== input.rowVersion) return null;

    const nextVersion = existing.version + 1;
    const updated = await tx.ticketTemplate.update({
      where: { tenantId_code_channel_locale: { tenantId, code, channel, locale } },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.body !== undefined ? { body: sanitizeTicketTemplateBody(input.body) } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        version: nextVersion,
        rowVersion: input.rowVersion + 1,
      },
    });
    await insertRevision(tx, {
      tenantId,
      templateId: updated.id,
      version: nextVersion,
      title: updated.title,
      body: updated.body,
      channel: updated.channel,
      locale: updated.locale,
      enabled: updated.enabled,
      createdByUserId: input.updatedByUserId ?? null,
    });
    return mapRow(updated);
  });
}

export async function rollbackTicketTemplate(
  tenantId: string,
  code: string,
  channel: TicketTemplateChannel,
  locale: TicketTemplateLocale,
  version: number,
  updatedByUserId?: string | null,
): Promise<TicketTemplateRecord | null> {
  return withTenantRls(tenantId, async (tx) => {
    const existing = await tx.ticketTemplate.findFirst({
      where: { tenantId, code, channel, locale, archivedAt: null },
    });
    if (existing === null) return null;
    const revision = await tx.ticketTemplateRevision.findFirst({
      where: { tenantId, templateId: existing.id, version },
    });
    if (revision === null) return null;

    const nextVersion = existing.version + 1;
    const updated = await tx.ticketTemplate.update({
      where: { tenantId_code_channel_locale: { tenantId, code, channel, locale } },
      data: {
        title: revision.title,
        body: revision.body,
        enabled: revision.enabled,
        version: nextVersion,
        rowVersion: existing.rowVersion + 1,
      },
    });
    await insertRevision(tx, {
      tenantId,
      templateId: updated.id,
      version: nextVersion,
      title: updated.title,
      body: updated.body,
      channel: updated.channel,
      locale: updated.locale,
      enabled: updated.enabled,
      createdByUserId: updatedByUserId ?? null,
    });
    return mapRow(updated);
  });
}

export async function listTicketTemplateRevisions(
  tenantId: string,
  code: string,
  channel: TicketTemplateChannel,
  locale: TicketTemplateLocale,
): Promise<readonly Record<string, unknown>[]> {
  return withTenantRls(tenantId, async (tx) => {
    const template = await tx.ticketTemplate.findFirst({
      where: { tenantId, code, channel, locale, archivedAt: null },
      select: { id: true },
    });
    if (template === null) return [];
    const rows = await tx.ticketTemplateRevision.findMany({
      where: { tenantId, templateId: template.id },
      orderBy: { version: "desc" },
    });
    return rows.map((row) => ({
      version: row.version,
      title: row.title,
      body: row.body,
      channel: row.channel,
      locale: row.locale,
      enabled: row.enabled,
      createdAt: toIso(row.createdAt),
    }));
  });
}

export async function findEnabledTemplateForAutomation(
  tenantId: string,
  channel: TicketTemplateChannel,
  locale: TicketTemplateLocale,
): Promise<TicketTemplateRecord | null> {
  await ensureDefaultTicketTemplatesForTenant(tenantId);
  return withTenantRls(tenantId, async (tx) => {
    const row = await tx.ticketTemplate.findFirst({
      where: { tenantId, channel, locale, enabled: true, archivedAt: null },
      orderBy: [{ isSystemDefault: "desc" }, { updatedAt: "desc" }],
    });
    return row === null ? null : mapRow(row);
  });
}

export async function hasTicketTemplateAutomationActivation(
  tenantId: string,
  domainEventId: string,
): Promise<boolean> {
  return withTenantRls(tenantId, async (tx) => {
    const row = await tx.ticketTemplateAutomationActivation.findFirst({
      where: { tenantId, domainEventId },
      select: { id: true },
    });
    return row !== null;
  });
}

export async function tryActivateTicketTemplateAutomation(
  tenantId: string,
  input: {
    readonly domainEventId: string;
    readonly templateCode: string;
    readonly locale: TicketTemplateLocale;
    readonly channel: TicketTemplateChannel;
    readonly ticketId?: string | null;
  },
): Promise<boolean> {
  return withTenantRls(tenantId, async (tx) => {
    try {
      await tx.ticketTemplateAutomationActivation.create({
        data: {
          tenantId,
          domainEventId: input.domainEventId,
          templateCode: input.templateCode,
          locale: input.locale,
          channel: input.channel,
          ticketId: input.ticketId ?? null,
        },
      });
      return true;
    } catch (error: unknown) {
      if (isPrismaUniqueConstraintError(error)) return false;
      throw error;
    }
  });
}

export async function seedTicketTemplateForTests(
  tenantId: string,
  seed: TicketingDefaultTemplateSeed,
): Promise<TicketTemplateRecord> {
  return createTicketTemplate(tenantId, seed);
}
