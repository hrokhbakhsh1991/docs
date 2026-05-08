import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import Redis from "ioredis";
import { ConfigModule } from "../../config/config.module";
import { ConfigService } from "../../config/config.service";
import { TENANT_MANAGEMENT_DB_PORT } from "../../common/contracts/workspace-invites.contract";
import { TenantEntity } from "../identity/entities/tenant.entity";
import { TenantBootstrapService } from "./tenant-bootstrap.service";
import { TenantHostCacheInvalidationSubscriber } from "./tenant-host-cache-invalidation.subscriber";
import { TenantHostResolverService } from "./tenant-host-resolver.service";
import { TenantManagementDbService } from "./tenant-management-db.service";
import { TENANT_RESOLVER_REDIS } from "./tenant-resolver.constants";

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([TenantEntity])],
  providers: [
    {
      provide: TENANT_RESOLVER_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redis = config.getRedisConfig();
        return new Redis({
          host: redis.host,
          port: redis.port,
          maxRetriesPerRequest: 2,
          lazyConnect: true
        });
      }
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
