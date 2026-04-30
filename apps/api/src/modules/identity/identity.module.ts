import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TenantEntity } from "./entities/tenant.entity";
import { UserEntity } from "./entities/user.entity";
import { UserTenantEntity } from "./entities/user-tenant.entity";

@Module({
  imports: [TypeOrmModule.forFeature([TenantEntity, UserEntity, UserTenantEntity])],
  exports: [TypeOrmModule]
})
export class IdentityModule {}
