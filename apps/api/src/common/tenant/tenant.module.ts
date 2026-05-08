import { Global, Module } from "@nestjs/common";
import { TenantAbuseModule } from "../tenant-abuse/tenant-abuse.module";
import { TenantUsageModule } from "../billing/tenant-usage.module";
import { TENANT_RUNTIME_GUARD } from "../contracts/tenant-runtime.contract";
import { TenantBootstrapModule } from "../../modules/tenant/tenant-bootstrap.module";
import { TenantMiddleware } from "./tenant.middleware";
import { TenantResolverMiddleware } from "./tenant-resolver.middleware";
import { TenantRuntimeGuardService } from "./tenant-runtime-guard.service";

@Global()
@Module({
  imports: [TenantBootstrapModule, TenantAbuseModule, TenantUsageModule],
  providers: [
    TenantMiddleware,
    TenantResolverMiddleware,
    TenantRuntimeGuardService,
    {
      provide: TENANT_RUNTIME_GUARD,
      useExisting: TenantRuntimeGuardService
    }
  ],
  exports: [
    TenantMiddleware,
    TenantResolverMiddleware,
    TenantRuntimeGuardService,
    TENANT_RUNTIME_GUARD,
    TenantBootstrapModule
  ]
})
export class TenantModule {}
