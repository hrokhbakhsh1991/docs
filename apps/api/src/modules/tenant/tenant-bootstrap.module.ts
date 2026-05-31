import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "../../config/config.module";
import { TENANT_MANAGEMENT_DB_PORT } from "../../common/contracts/workspace-invites.contract";
import { TenantEntity } from "../identity/entities/tenant.entity";
import { TenantCustomDomainEntity } from "./entities/tenant-custom-domain.entity";
import { TenantBootstrapService } from "./tenant-bootstrap.service";
import { TenantCorsPolicyService } from "./tenant-cors-policy.service";
import { TenantCustomDomainCacheInvalidationSubscriber } from "./adapters/tenant-custom-domain-cache-invalidation.subscriber";
import { TENANT_INGRESS_REGISTRY_PORT } from "./domain/ports/tenant-ingress-registry.port";
import { TenantIngressRegistryRepository } from "./repositories/tenant-ingress-registry.repository";
import { TenantHostCacheInvalidationSubscriber } from "./tenant-host-cache-invalidation.subscriber";
import { TenantHostResolverService } from "./tenant-host-resolver.service";
import { TenantManagementDbService } from "./tenant-management-db.service";
import { TENANT_RESOLVER_REDIS } from "./tenant-resolver.constants";
import { REDIS_CLIENT } from "../../infra/redis/redis.constants";

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([TenantEntity, TenantCustomDomainEntity])],
  providers: [
    {
      provide: TENANT_RESOLVER_REDIS,
      useExisting: REDIS_CLIENT
    },
    TenantBootstrapService,
    TenantManagementDbService,
    TenantIngressRegistryRepository,
    {
      provide: TENANT_INGRESS_REGISTRY_PORT,
      useExisting: TenantIngressRegistryRepository,
    },
    TenantCorsPolicyService,
    {
      provide: TENANT_MANAGEMENT_DB_PORT,
      useExisting: TenantManagementDbService
    },
    TenantHostResolverService,
    TenantHostCacheInvalidationSubscriber,
    TenantCustomDomainCacheInvalidationSubscriber
  ],
  exports: [
    TenantBootstrapService,
    TenantHostResolverService,
    TENANT_INGRESS_REGISTRY_PORT,
    TenantIngressRegistryRepository,
    TenantCorsPolicyService,
    TenantManagementDbService,
    TENANT_MANAGEMENT_DB_PORT,
    TENANT_RESOLVER_REDIS
  ]
})
export class TenantBootstrapModule {}
