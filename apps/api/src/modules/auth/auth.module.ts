import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { IdempotencyModule } from "../idempotency/idempotency.module";
import { TenantEntity } from "../identity/entities/tenant.entity";
import { UserEntity } from "../identity/entities/user.entity";
import { UserTenantEntity } from "../identity/entities/user-tenant.entity";
import { WorkspaceInviteEntity } from "../identity/entities/workspace-invite.entity";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { WorkspaceService } from "./workspace.service";
import { AuthorizationPresenceGuard } from "./authorization-presence.guard";
import { RolesGuard } from "./roles.guard";
@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, UserTenantEntity, TenantEntity, WorkspaceInviteEntity]),
    IdempotencyModule
  ],
  controllers: [AuthController],
  providers: [AuthService, WorkspaceService, AuthorizationPresenceGuard, RolesGuard],
  exports: [AuthorizationPresenceGuard, RolesGuard]
})
export class AuthModule {}
