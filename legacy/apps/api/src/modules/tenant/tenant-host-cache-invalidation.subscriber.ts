import { Injectable } from "@nestjs/common";
import {
  DataSource,
  EventSubscriber,
  EntitySubscriberInterface,
  SoftRemoveEvent,
  UpdateEvent
} from "typeorm";
import { TenantEntity } from "../identity/entities/tenant.entity";
import { TenantHostResolverService } from "./tenant-host-resolver.service";

@Injectable()
@EventSubscriber()
export class TenantHostCacheInvalidationSubscriber
  implements EntitySubscriberInterface<TenantEntity>
{
  constructor(
    dataSource: DataSource,
    private readonly tenantHostResolver: TenantHostResolverService
  ) {
    if (dataSource && Array.isArray(dataSource.subscribers)) {
      dataSource.subscribers.push(this);
    }
  }

  listenTo(): typeof TenantEntity {
    return TenantEntity;
  }

  async afterUpdate(event: UpdateEvent<TenantEntity>): Promise<void> {
    const prevSubdomain =
      typeof event.databaseEntity?.subdomain === "string"
        ? event.databaseEntity.subdomain
        : null;
    const nextSubdomain =
      typeof event.entity?.subdomain === "string" ? event.entity.subdomain : null;

    if (prevSubdomain && prevSubdomain.trim() !== "") {
      await this.tenantHostResolver.invalidateTenantHostCacheByLabel(prevSubdomain);
    }
    if (nextSubdomain && nextSubdomain.trim() !== "") {
      await this.tenantHostResolver.invalidateTenantHostCacheByLabel(nextSubdomain);
    }
  }

  async afterSoftRemove(event: SoftRemoveEvent<TenantEntity>): Promise<void> {
    const subdomain =
      typeof event.databaseEntity?.subdomain === "string"
        ? event.databaseEntity.subdomain
        : typeof event.entity?.subdomain === "string"
          ? event.entity.subdomain
          : null;
    if (subdomain && subdomain.trim() !== "") {
      await this.tenantHostResolver.invalidateTenantHostCacheByLabel(subdomain);
    }
  }
}

