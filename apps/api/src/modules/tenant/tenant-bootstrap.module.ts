import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "../../config/config.module";
import { TENANT_MANAGEMENT_DB_PORT } from "../../common/contracts/workspace-invites.contract";
import { TenantEntity } from "../identity/entities/tenant.entity";
import { TenantBootstrapService } from "./tenant-bootstrap.service";
import { TenantHostCacheInvalidationSubscriber } from "./tenant-host-cache-invalidation.subscriber";
import { TenantHostResolverService } from "./tenant-host-resolver.service";
import { TenantManagementDbService } from "./tenant-management-db.service";
import { TENANT_RESOLVER_REDIS } from "./tenant-resolver.constants";
import { REDIS_CLIENT } from "../../infra/redis/redis.constants";

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([TenantEntity])],
  providers: [
    {
      provide: TENANT_RESOLVER_REDIS,
      useExisting: REDIS_CLIENT
    },
    TenantBootstrapService,
    TenantManagementDbService,
    {
      provide: TENANT_MANAGEMENT_DB_PORT,
      useExisting: TenantManagementDbService
    },
    TenantHostResolverService,
    TenantHostCacheInvalidationSubscriber
  ],
  exports: [
    TenantBootstrapService,
    TenantHostResolverService,
    TenantManagementDbService,
    TENANT_MANAGEMENT_DB_PORT,
    TENANT_RESOLVER_REDIS
  ]
})
export class TenantBootstrapModule {}
