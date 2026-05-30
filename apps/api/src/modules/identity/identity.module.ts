import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { AuthModule } from "../auth/auth.module";
import { UsersController } from "./users.controller";
import { TenantEntity } from "./entities/tenant.entity";
import { UserEntity } from "./entities/user.entity";
import { UserTenantEntity } from "./entities/user-tenant.entity";
import { UserRoleAuditEntity } from "./entities/user-role-audit.entity";
import { WorkspaceInviteEntity } from "./entities/workspace-invite.entity";
import { EmailVerificationTokenEntity } from "./entities/email-verification-token.entity";
import { InvitesController } from "./invites.controller";
import { WorkspaceOwnershipController } from "./workspace-ownership.controller";
import { WorkspaceUsersCapabilitiesController } from "./workspace-users-capabilities.controller";
import { WorkspaceUsersController } from "./workspace-users.controller";
import { WorkspaceUsersService } from "./workspace-users.service";
import { WorkspaceSettingsModulesController } from "./workspace-settings-modules.controller";
import { TenantAuditEventsController } from "./tenant-audit-events.controller";
import { WORKSPACE_IDENTITY_REPOSITORY_PORT } from "./domain/ports/workspace-identity-repository.port";
import { TypeOrmIdentityRepository } from "./repositories/typeorm-identity.repository";
import { UsersReadService } from "./users-read.service";
import { UsersAccessService } from "./users-access.service";
import { UsersWriteService } from "./users-write.service";
import { UsersAuditService } from "./users-audit.service";
import { UsersInviteService } from "./services/users-invite.service";
import { MeController } from "./me.controller";
import { MeService } from "./me.service";
import { IdempotencyModule } from "../idempotency/idempotency.module";
import { OutboxModule } from "../outbox/outbox.module";
import { AccountBalanceEntity } from "../finance/ledger/entities/account-balance.entity";
import { RegistrationEntity } from "../registrations/registration.entity";
import { TourDepartureEntity } from "../tours/entities/tour-departure.entity";
import { TourEntity } from "../tours/entities/tour.entity";
import { TourProductEntity } from "../tours/entities/tour-product.entity";
import { UsersMemberWalletBalancesService } from "./users-member-wallet-balances.service";
import { WorkspaceUserBookingSummaryService } from "./workspace-user-booking-summary.service";
import { CapabilityGuard } from "./guards/capability.guard";
import { RateLimitMeterInterceptor } from "./interceptors/rate-limit-meter.interceptor";

@Module({
  imports: [
    AuthModule,
    IdempotencyModule,
    forwardRef(() => OutboxModule),
    TypeOrmModule.forFeature([
      TenantEntity,
      UserEntity,
      UserTenantEntity,
      UserRoleAuditEntity,
      WorkspaceInviteEntity,
      EmailVerificationTokenEntity,
      AccountBalanceEntity,
      RegistrationEntity,
      TourDepartureEntity,
      TourEntity,
      TourProductEntity,
    ]),
  ],
  controllers: [
    UsersController,
    InvitesController,
    WorkspaceOwnershipController,
    WorkspaceUsersCapabilitiesController,
    WorkspaceUsersController,
    WorkspaceSettingsModulesController,
    TenantAuditEventsController,
    MeController,
  ],
  providers: [
    {
      provide: WORKSPACE_IDENTITY_REPOSITORY_PORT,
      useClass: TypeOrmIdentityRepository,
    },
    UsersAccessService,
    UsersMemberWalletBalancesService,
    WorkspaceUserBookingSummaryService,
    UsersReadService,
    UsersWriteService,
    UsersAuditService,
    UsersInviteService,
    WorkspaceUsersService,
    MeService,
    CapabilityGuard,
    {
      provide: APP_GUARD,
      useExisting: CapabilityGuard,
    },
    RateLimitMeterInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useExisting: RateLimitMeterInterceptor,
    },
  ],
  exports: [
    WORKSPACE_IDENTITY_REPOSITORY_PORT,
    UsersAccessService,
    UsersReadService,
    UsersWriteService,
    UsersAuditService,
    CapabilityGuard,
  ],
})
export class IdentityModule {}
