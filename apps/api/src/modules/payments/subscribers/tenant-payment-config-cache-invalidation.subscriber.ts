import { Injectable } from "@nestjs/common";
import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  RemoveEvent,
  SoftRemoveEvent,
  UpdateEvent,
} from "typeorm";
import type { AfterQueryEvent } from "typeorm";

import { TenantPaymentConfigEntity } from "../entities/tenant-payment-config.entity";
import {
  TenantPaymentConfigService,
  type TenantPaymentConfigCacheEvictionOrigin,
} from "../services/tenant-payment-config.service";
import {
  resolveTenantIdsFromPaymentConfigQueryEvent,
  resolveTenantIdsFromRemoveEvent,
  resolveTenantIdsFromUpdateEvent,
} from "./tenant-payment-config-mutation-resolver";

@Injectable()
@EventSubscriber()
export class TenantPaymentConfigCacheInvalidationSubscriber
  implements EntitySubscriberInterface<TenantPaymentConfigEntity>
{
  constructor(
    dataSource: DataSource,
    private readonly tenantPaymentConfigService: TenantPaymentConfigService,
  ) {
    if (dataSource && Array.isArray(dataSource.subscribers)) {
      dataSource.subscribers.push(this);
    }
  }

  listenTo(): typeof TenantPaymentConfigEntity {
    return TenantPaymentConfigEntity;
  }

  private invalidateTenantIds(
    tenantIds: readonly string[],
    origin: TenantPaymentConfigCacheEvictionOrigin,
    meta?: Record<string, unknown>,
  ): void {
    const seen = new Set<string>();
    for (const tenantId of tenantIds) {
      const normalized = tenantId.trim().toLowerCase();
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      this.tenantPaymentConfigService.invalidateTenant(tenantId, { origin, ...meta });
      void this.tenantPaymentConfigService.publishDistributedInvalidation(tenantId);
    }
  }

  private invalidateTenantForEntity(
    entity: TenantPaymentConfigEntity | undefined,
    origin: TenantPaymentConfigCacheEvictionOrigin,
  ): void {
    const tenantId = entity?.tenantId;
    if (tenantId) {
      this.tenantPaymentConfigService.invalidateTenant(tenantId, { origin });
      void this.tenantPaymentConfigService.publishDistributedInvalidation(tenantId);
    }
  }

  afterInsert(event: InsertEvent<TenantPaymentConfigEntity>): void {
    this.invalidateTenantForEntity(event.entity, "subscriber:afterInsert");
  }

  async afterUpdate(event: UpdateEvent<TenantPaymentConfigEntity>): Promise<void> {
    const tenantIds = await resolveTenantIdsFromUpdateEvent(event);
    this.invalidateTenantIds(tenantIds, "subscriber:afterUpdate", {
      had_entity: event.entity != null,
      had_database_entity: event.databaseEntity != null,
    });
  }

  async afterRemove(event: RemoveEvent<TenantPaymentConfigEntity>): Promise<void> {
    const tenantIds = await resolveTenantIdsFromRemoveEvent(event);
    this.invalidateTenantIds(tenantIds, "subscriber:afterRemove", {
      had_entity: event.entity != null,
      had_database_entity: event.databaseEntity != null,
      had_entity_id: event.entityId != null,
    });
  }

  async afterSoftRemove(event: SoftRemoveEvent<TenantPaymentConfigEntity>): Promise<void> {
    const tenantIds = await resolveTenantIdsFromRemoveEvent(event);
    this.invalidateTenantIds(tenantIds, "subscriber:afterSoftRemove", {
      had_database_entity: event.databaseEntity != null,
    });
  }

  async afterQuery(event: AfterQueryEvent<TenantPaymentConfigEntity>): Promise<void> {
    const tenantIds = await resolveTenantIdsFromPaymentConfigQueryEvent(event);
    if (tenantIds.length === 0) {
      return;
    }
    this.invalidateTenantIds(tenantIds, "subscriber:afterQuery", {
      query_preview: event.query.slice(0, 240),
    });
  }
}
