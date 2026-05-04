import { Global, Module } from "@nestjs/common";
import { TenantBootstrapModule } from "../../modules/tenant/tenant-bootstrap.module";
import { TenantMiddleware } from "./tenant.middleware";

@Global()
@Module({
  imports: [TenantBootstrapModule],
  providers: [TenantMiddleware],
  exports: [TenantMiddleware, TenantBootstrapModule]
})
export class TenantModule {}
