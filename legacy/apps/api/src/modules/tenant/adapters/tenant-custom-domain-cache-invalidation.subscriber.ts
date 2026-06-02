import { Inject, Injectable } from "@nestjs/common";
import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  RemoveEvent,
  SoftRemoveEvent,
  UpdateEvent,
} from "typeorm";

import { TenantCustomDomainEntity } from "../entities/tenant-custom-domain.entity";
import {
  TENANT_INGRESS_REGISTRY_PORT,
  type TenantIngressRegistryPort,
} from "../domain/ports/tenant-ingress-registry.port";

@Injectable()
@EventSubscriber()
export class TenantCustomDomainCacheInvalidationSubscriber
  implements EntitySubscriberInterface<TenantCustomDomainEntity>
{
  constructor(
    dataSource: DataSource,
    @Inject(TENANT_INGRESS_REGISTRY_PORT)
    private readonly ingressRegistry: TenantIngressRegistryPort,
  ) {
    if (dataSource && Array.isArray(dataSource.subscribers)) {
      dataSource.subscribers.push(this);
    }
  }

  listenTo(): typeof TenantCustomDomainEntity {
    return TenantCustomDomainEntity;
  }

  private async invalidateEntity(entity: TenantCustomDomainEntity | undefined): Promise<void> {
    if (!entity) {
      return;
    }
    await this.ingressRegistry.invalidateCustomDomainCaches({
      hostname: entity.hostname,
      webOrigin: entity.webOrigin,
    });
  }

  async afterInsert(event: InsertEvent<TenantCustomDomainEntity>): Promise<void> {
    await this.invalidateEntity(event.entity);
  }

  async afterUpdate(event: UpdateEvent<TenantCustomDomainEntity>): Promise<void> {
    await this.invalidateEntity(event.databaseEntity as TenantCustomDomainEntity | undefined);
    await this.invalidateEntity(event.entity as TenantCustomDomainEntity | undefined);
  }

  async afterRemove(event: RemoveEvent<TenantCustomDomainEntity>): Promise<void> {
    await this.invalidateEntity(event.databaseEntity as TenantCustomDomainEntity | undefined);
  }

  async afterSoftRemove(event: SoftRemoveEvent<TenantCustomDomainEntity>): Promise<void> {
    await this.invalidateEntity(event.databaseEntity as TenantCustomDomainEntity | undefined);
  }
}
