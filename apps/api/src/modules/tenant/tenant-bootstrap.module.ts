import { Module } from "@nestjs/common";
import { TenantBootstrapService } from "./tenant-bootstrap.service";

@Module({
  providers: [TenantBootstrapService],
  exports: [TenantBootstrapService]
})
export class TenantBootstrapModule {}
