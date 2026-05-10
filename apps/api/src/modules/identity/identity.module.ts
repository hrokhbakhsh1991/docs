import { Module } from "@nestjs/common";
import { getRepositoryToken, TypeOrmModule } from "@nestjs/typeorm";
import { DataSource, type Repository } from "typeorm";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { OtpService } from "../auth/otp.service";
import { TenantAuditEventsService } from "../../common/audit/tenant-audit-events.service";
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
import { IdempotencyModule } from "../idempotency/idempotency.module";
import { OutboxService } from "../outbox/outbox.service";
import { OutboxModule } from "../outbox/outbox.module";

@Module({
  imports: [
    IdempotencyModule,
    OutboxModule,
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
    {
      provide: MeService,
      useFactory: (
        userRepository: Repository<UserEntity>,
        dataSource: DataSource,
        usersAccess: UsersAccessService,
        requestContext: RequestContextService,
        outboxService: OutboxService,
        otpService: OtpService,
        tenantAuditEventsService: TenantAuditEventsService
      ) =>
        new MeService(
          userRepository,
          dataSource,
          usersAccess,
          requestContext,
          outboxService,
          otpService,
          tenantAuditEventsService
        ),
      inject: [
        getRepositoryToken(UserEntity),
        DataSource,
        UsersAccessService,
        RequestContextService,
        OutboxService,
        OtpService,
        TenantAuditEventsService
      ]
    }
  ],
  exports: [TypeOrmModule, UsersReadService, UsersWriteService, UsersAuditService]
})
export class IdentityModule {}
