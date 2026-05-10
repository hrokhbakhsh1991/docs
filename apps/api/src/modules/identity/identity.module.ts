import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersController } from "./users.controller";
import { TenantEntity } from "./entities/tenant.entity";
import { UserEntity } from "./entities/user.entity";
import { UserTenantEntity } from "./entities/user-tenant.entity";
import { UserRoleAuditEntity } from "./entities/user-role-audit.entity";
import { WorkspaceInviteEntity } from "./entities/workspace-invite.entity";
import { EmailVerificationTokenEntity } from "./entities/email-verification-token.entity";
import { InvitesController } from "./invites.controller";
import { WorkspaceOwnershipController } from "./workspace-ownership.controller";
import { TenantAuditEventsController } from "./tenant-audit-events.controller";
import { UsersAccessService } from "./users-access.service";
import { UsersReadService } from "./users-read.service";
import { UsersWriteService } from "./users-write.service";
import { UsersAuditService } from "./users-audit.service";
import { UsersInviteService } from "./services/users-invite.service";
import { MeController } from "./me.controller";
import { MeService } from "./me.service";
@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantEntity,
      UserEntity,
      UserTenantEntity,
      UserRoleAuditEntity,
      WorkspaceInviteEntity,
      EmailVerificationTokenEntity
    ])
  ],
  controllers: [
    UsersController,
    InvitesController,
    WorkspaceOwnershipController,
    TenantAuditEventsController,
    MeController
  ],
  providers: [
    UsersAccessService,
    UsersReadService,
    UsersWriteService,
    UsersAuditService,
    UsersInviteService,
    MeService
  ],
  exports: [TypeOrmModule, UsersReadService, UsersWriteService, UsersAuditService]
})
export class IdentityModule {}
