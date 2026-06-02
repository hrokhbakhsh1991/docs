import type { EntityManager } from "typeorm";
import type { AfterQueryEvent, RemoveEvent, UpdateEvent } from "typeorm";

import { TenantPaymentConfigEntity } from "../entities/tenant-payment-config.entity";

const TABLE_NAME = "tenant_payment_configs";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROW_ID_TENANT_CACHE_MAX = 256;
const tenantIdByRowIdCache = new Map<string, string>();

type CriteriaCarrier = {
  criteria?: unknown;
};

function cacheTenantIdForRow(rowId: string, tenantId: string): void {
  const key = rowId.trim().toLowerCase();
  if (!key) {
    return;
  }
  if (tenantIdByRowIdCache.size >= ROW_ID_TENANT_CACHE_MAX && !tenantIdByRowIdCache.has(key)) {
    const oldest = tenantIdByRowIdCache.keys().next().value;
    if (oldest !== undefined) {
      tenantIdByRowIdCache.delete(oldest);
    }
  }
  tenantIdByRowIdCache.set(key, tenantId);
}

function readCachedTenantIdForRow(rowId: string): string | undefined {
  return tenantIdByRowIdCache.get(rowId.trim().toLowerCase());
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

function readTenantId(record: Record<string, unknown> | undefined): string | undefined {
  if (!record) {
    return undefined;
  }
  const raw = record.tenantId ?? record.tenant_id;
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : undefined;
}

function readRowId(record: Record<string, unknown> | undefined): string | undefined {
  if (!record) {
    return undefined;
  }
  const raw = record.id;
  return isUuid(raw) ? raw.trim() : undefined;
}

async function resolveTenantIdByRowId(
  manager: EntityManager,
  rowId: string,
): Promise<string | undefined> {
  const cached = readCachedTenantIdForRow(rowId);
  if (cached) {
    return cached;
  }
  const row = await manager.findOne(TenantPaymentConfigEntity, {
    where: { id: rowId },
    select: { id: true, tenantId: true },
  });
  if (row?.tenantId) {
    cacheTenantIdForRow(rowId, row.tenantId);
  }
  return row?.tenantId;
}

export async function resolveTenantIdsFromCriteria(
  criteria: unknown,
  manager: EntityManager,
): Promise<string[]> {
  const tenantIds = new Set<string>();
  if (criteria == null) {
    return [];
  }

  const absorbCriteria = async (value: unknown): Promise<void> => {
    if (value == null) {
      return;
    }
    if (typeof value === "string" || typeof value === "number") {
      const rowId = String(value);
      if (!isUuid(rowId)) {
        return;
      }
      const tenantId = await resolveTenantIdByRowId(manager, rowId);
      if (tenantId) {
        tenantIds.add(tenantId);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        await absorbCriteria(entry);
      }
      return;
    }
    if (typeof value !== "object") {
      return;
    }
    const record = value as Record<string, unknown>;
    const directTenantId = readTenantId(record);
    if (directTenantId) {
      tenantIds.add(directTenantId);
      return;
    }
    const rowId = readRowId(record);
    if (rowId) {
      const tenantId = await resolveTenantIdByRowId(manager, rowId);
      if (tenantId) {
        tenantIds.add(tenantId);
      }
    }
  };

  await absorbCriteria(criteria);
  return [...tenantIds];
}

function collectTenantIdsFromEntityLike(
  entity: Record<string, unknown> | undefined,
): string[] {
  const tenantId = readTenantId(entity);
  return tenantId ? [tenantId] : [];
}

export async function resolveTenantIdsFromUpdateEvent(
  event: UpdateEvent<TenantPaymentConfigEntity>,
): Promise<string[]> {
  const tenantIds = new Set<string>();

  const criteria = (event as UpdateEvent<TenantPaymentConfigEntity> & CriteriaCarrier).criteria;
  for (const tenantId of await resolveTenantIdsFromCriteria(criteria, event.manager)) {
    tenantIds.add(tenantId);
  }
  if (tenantIds.size > 0) {
    return [...tenantIds];
  }

  for (const source of [
    event.entity as Record<string, unknown> | undefined,
    event.databaseEntity as unknown as Record<string, unknown> | undefined,
  ]) {
    for (const tenantId of collectTenantIdsFromEntityLike(source)) {
      tenantIds.add(tenantId);
    }
    const rowId = readRowId(source);
    if (rowId) {
      const tenantId = await resolveTenantIdByRowId(event.manager, rowId);
      if (tenantId) {
        tenantIds.add(tenantId);
      }
    }
  }

  return [...tenantIds];
}

export async function resolveTenantIdsFromRemoveEvent(
  event: RemoveEvent<TenantPaymentConfigEntity>,
): Promise<string[]> {
  const tenantIds = new Set<string>();

  const criteria = (event as RemoveEvent<TenantPaymentConfigEntity> & CriteriaCarrier).criteria;
  for (const tenantId of await resolveTenantIdsFromCriteria(criteria, event.manager)) {
    tenantIds.add(tenantId);
  }
  if (tenantIds.size > 0) {
    return [...tenantIds];
  }

  for (const source of [
    event.entity as Record<string, unknown> | undefined,
    event.databaseEntity as unknown as Record<string, unknown> | undefined,
  ]) {
    for (const tenantId of collectTenantIdsFromEntityLike(source)) {
      tenantIds.add(tenantId);
    }
    const rowId = readRowId(source);
    if (rowId) {
      const tenantId = await resolveTenantIdByRowId(event.manager, rowId);
      if (tenantId) {
        tenantIds.add(tenantId);
      }
    }
  }

  if (event.entityId != null) {
    for (const tenantId of await resolveTenantIdsFromCriteria(event.entityId, event.manager)) {
      tenantIds.add(tenantId);
    }
  }

  return [...tenantIds];
}

export function isTenantPaymentConfigMutationQuery(query: string): boolean {
  const normalized = query.toLowerCase();
  if (!normalized.includes(TABLE_NAME)) {
    return false;
  }
  return /\b(update|delete|insert\s+into)\b/.test(normalized);
}

function readParameterAt(parameters: unknown[] | undefined, sqlIndex: number): unknown {
  if (!parameters?.length || sqlIndex < 1) {
    return undefined;
  }
  return parameters[sqlIndex - 1];
}

function collectSqlParameterIndices(query: string, column: string): number[] {
  const indices = new Set<number>();
  const patterns = [
    new RegExp(`"${column}"\\s*=\\s*\\$(\\d+)`, "gi"),
    new RegExp(`\\b${column}\\s*=\\s*\\$(\\d+)`, "gi"),
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(query)) !== null) {
      indices.add(Number(match[1]));
    }
  }
  return [...indices];
}

export async function resolveTenantIdsFromPaymentConfigQuery(
  query: string,
  parameters: unknown[] | undefined,
  manager: EntityManager,
): Promise<string[]> {
  if (!isTenantPaymentConfigMutationQuery(query)) {
    return [];
  }

  const tenantIds = new Set<string>();

  for (const sqlIndex of collectSqlParameterIndices(query, "tenant_id")) {
    const value = readParameterAt(parameters, sqlIndex);
    if (typeof value === "string" && value.trim() !== "") {
      tenantIds.add(value.trim());
    }
  }

  for (const sqlIndex of collectSqlParameterIndices(query, "id")) {
    const value = readParameterAt(parameters, sqlIndex);
    if (!isUuid(value)) {
      continue;
    }
    const tenantId = await resolveTenantIdByRowId(manager, value);
    if (tenantId) {
      tenantIds.add(tenantId);
    }
  }

  return [...tenantIds];
}

export async function resolveTenantIdsFromPaymentConfigQueryEvent(
  event: AfterQueryEvent<TenantPaymentConfigEntity>,
): Promise<string[]> {
  if (!event.success) {
    return [];
  }
  return resolveTenantIdsFromPaymentConfigQuery(event.query, event.parameters, event.manager);
}
