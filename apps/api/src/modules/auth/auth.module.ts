import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { IdempotencyModule } from "../idempotency/idempotency.module";
import { UserEntity } from "../identity/entities/user.entity";
import { UserTenantEntity } from "../identity/entities/user-tenant.entity";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { WorkspaceService } from "./workspace.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { RolesGuard } from "./roles.guard";

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, UserTenantEntity]), IdempotencyModule],
  controllers: [AuthController],
  providers: [AuthService, WorkspaceService, JwtAuthGuard, RolesGuard],
  exports: [JwtAuthGuard, RolesGuard]
})
export class AuthModule {}
