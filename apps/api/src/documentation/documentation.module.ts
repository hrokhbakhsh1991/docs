import { Module } from "@nestjs/common";
import { getDataSourceToken } from "@nestjs/typeorm";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AppController } from "../app.controller";
import { LoggerService } from "../common/logger/logger.service";
import { UserRole, InternalActorRole } from "../common/auth/user-role.enum";
import { RequestContextService } from "../common/request-context/request-context.service";
import { ConfigService } from "../config/config.service";
import { SchedulerRuntimeMetricsService } from "../jobs/scheduler-runtime-metrics.service";
import { IdempotencyService } from "../modules/idempotency/idempotency.service";
import { AuthController } from "../modules/auth/auth.controller";
import { AuthService } from "../modules/auth/auth.service";
import { WorkspaceService } from "../modules/auth/workspace.service";
import { ObservabilityMetricsService } from "../common/observability/observability-metrics.service";
import { TenantAbuseMetricsService } from "../common/tenant-abuse/tenant-abuse-metrics.service";
import { TenantUsageMeteringService } from "../common/billing/tenant-usage-metering.service";
import { OpsController } from "../modules/ops/ops.controller";
import { OutboxMetricsService } from "../modules/outbox/outbox-metrics.service";
import { PaymentsController, PaymentsWebhookController } from "../modules/payments/payments.controller";
import { PaymentsService } from "../modules/payments/payments.service";
import { ReconciliationService } from "../modules/reconciliation/reconciliation.service";
import { MeController } from "../modules/identity/me.controller";
import { MeService } from "../modules/identity/me.service";
import { UsersController } from "../modules/identity/users.controller";
import { UsersAuditService } from "../modules/identity/users-audit.service";
import { UsersInviteService } from "../modules/identity/services/users-invite.service";
import { UsersReadService } from "../modules/identity/users-read.service";
import { UsersWriteService } from "../modules/identity/users-write.service";
import { RegistrationsController } from "../modules/registrations/registrations.controller";
import { RegistrationsService } from "../modules/registrations/registrations.service";
import { TenantBootstrapService } from "../modules/tenant/tenant-bootstrap.service";
import { EquipmentSettingsService } from "../modules/settings-locations/equipment-settings.service";
import { GuideLanguagesSettingsService } from "../modules/settings-locations/guide-languages-settings.service";
import { TourCreationPresetsSettingsService } from "../modules/settings-locations/tour-creation-presets-settings.service";
import { TourThemesSettingsService } from "../modules/settings-locations/tour-themes-settings.service";
import { SettingsDestinationsController } from "../modules/settings-locations/settings-destinations.controller";
import { SettingsDestinationsService } from "../modules/settings-locations/settings-destinations.service";
import { SettingsEquipmentController } from "../modules/settings-locations/settings-equipment.controller";
import { SettingsGuideLanguagesController } from "../modules/settings-locations/settings-guide-languages.controller";
import { SettingsTourCreationPresetsController } from "../modules/settings-locations/settings-tour-creation-presets.controller";
import { SettingsTourThemesController } from "../modules/settings-locations/settings-tour-themes.controller";
import { SettingsRegionsController } from "../modules/settings-locations/settings-regions.controller";
import { SettingsRegionsService } from "../modules/settings-locations/settings-regions.service";
import { ToursController } from "../modules/tours/tours.controller";
import { ToursService } from "../modules/tours/tours.service";

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: "public-registration",
          ttl: 60_000,
          limit: 10,
          blockDuration: 1
        },
        {
          name: "tour-create",
          ttl: 60_000,
          limit: 5000,
          blockDuration: 1
        }
      ]
    })
  ],
  controllers: [
    AppController,
    AuthController,
    ToursController,
    RegistrationsController,
    PaymentsController,
    PaymentsWebhookController,
    OpsController,
    MeController,
    UsersController,
    SettingsRegionsController,
    SettingsDestinationsController,
    SettingsEquipmentController,
    SettingsGuideLanguagesController,
    SettingsTourThemesController,
    SettingsTourCreationPresetsController
  ],
  providers: [
    {
      provide: getDataSourceToken(),
      useValue: {
        query: async () => []
      }
    },
    {
      provide: LoggerService,
      useValue: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined
      }
    },
    {
      provide: RequestContextService,
      useValue: {
        getRequestId: () => "openapi-build",
        getTenantId: () => "00000000-0000-4000-8000-000000000000",
        getUserId: () => "openapi-build-user",
        getRole: () => UserRole.Owner,
        resolveEffectiveTenantId: () => "00000000-0000-4000-8000-000000000000",
        getContext: () => ({
          requestId: "openapi-build",
          path: "/health",
          method: "GET",
          tenantId: "00000000-0000-4000-8000-000000000000",
          userId: "openapi-build-user",
          role: InternalActorRole.System
        }),
        setTenantId: () => undefined
      }
    },
    {
      provide: AuthService,
      useValue: {
        createWorkspaceSession: async () => ({
          session_token: "openapi-build-token",
          user_id: "00000000-0000-4000-8000-000000000001",
          tenant_id: "00000000-0000-4000-8000-000000000000",
          entry_mode: "web" as const
        })
      }
    },
    {
      provide: WorkspaceService,
      useValue: {
        listWorkspaces: async () => [],
        createWorkspace: async () => ({
          tenant_id: "00000000-0000-4000-8000-000000000000",
          tenant_name: "OpenAPI Workspace",
          tenant_subdomain: "openapi",
          role: "owner",
          session_version: 1
        })
      }
    },
    {
      provide: ConfigService,
      useValue: {
        getInternalApiKey: () => "openapi-build-key",
        getEnableSchedulers: () => false,
        getRuntimeRole: () => "api"
      }
    },
    { provide: ToursService, useValue: {} },
    {
      provide: SettingsRegionsService,
      useValue: {
        list: async () => [],
        create: async () => ({
          id: "00000000-0000-4000-8000-000000000002",
          name: "Region",
          country: null,
          sortOrder: 0,
          isActive: true
        }),
        update: async () => ({
          id: "00000000-0000-4000-8000-000000000002",
          name: "Region",
          country: null,
          sortOrder: 0,
          isActive: true
        }),
        remove: async () => undefined
      }
    },
    {
      provide: SettingsDestinationsService,
      useValue: {
        list: async () => [],
        create: async () => ({
          id: "00000000-0000-4000-8000-000000000003",
          name: "Destination",
          regionId: "00000000-0000-4000-8000-000000000002",
          type: null,
          altitudeM: null,
          sortOrder: 0,
          isActive: true
        }),
        update: async () => ({
          id: "00000000-0000-4000-8000-000000000003",
          name: "Destination",
          regionId: "00000000-0000-4000-8000-000000000002",
          type: null,
          altitudeM: null,
          sortOrder: 0,
          isActive: true
        }),
        remove: async () => undefined
      }
    },
    {
      provide: EquipmentSettingsService,
      useValue: {
        findAllByWorkspace: async () => [],
        create: async () => ({
          id: "00000000-0000-4000-8000-000000000001",
          name: "Example",
          slug: "example",
          category: null,
          description: null,
          icon: null,
          isActive: true,
          sortOrder: 0,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString()
        }),
        update: async () => ({
          id: "00000000-0000-4000-8000-000000000001",
          name: "Example",
          slug: "example",
          category: null,
          description: null,
          icon: null,
          isActive: true,
          sortOrder: 0,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString()
        }),
        remove: async () => undefined,
        reorder: async () => []
      }
    },
    {
      provide: GuideLanguagesSettingsService,
      useValue: {
        findAllByWorkspace: async () => [],
        create: async () => ({
          id: "00000000-0000-4000-8000-000000000010",
          name: "English",
          slug: "english",
          isActive: true,
          sortOrder: 0,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString()
        }),
        update: async () => ({
          id: "00000000-0000-4000-8000-000000000010",
          name: "English",
          slug: "english",
          isActive: true,
          sortOrder: 0,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString()
        }),
        remove: async () => undefined,
        reorder: async () => []
      }
    },
    {
      provide: TourThemesSettingsService,
      useValue: {
        findAllByWorkspace: async () => [],
        create: async () => ({
          id: "00000000-0000-4000-8000-000000000010",
          name: "Wildlife",
          slug: "wildlife",
          description: null,
          isActive: true,
          sortOrder: 0,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString()
        }),
        update: async () => ({
          id: "00000000-0000-4000-8000-000000000010",
          name: "Wildlife",
          slug: "wildlife",
          description: null,
          isActive: true,
          sortOrder: 0,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString()
        }),
        remove: async () => undefined,
        reorder: async () => []
      }
    },
    {
      provide: TourCreationPresetsSettingsService,
      useValue: {
        findAllByWorkspace: async () => [],
        create: async () => ({
          id: "00000000-0000-4000-8000-000000000011",
          name: "Mountain preset",
          description: null,
          isActive: true,
          sortOrder: 0,
          matchTourType: null,
          matchMainTourThemeId: null,
          defaults: {},
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString()
        }),
        update: async () => ({
          id: "00000000-0000-4000-8000-000000000011",
          name: "Mountain preset",
          description: null,
          isActive: true,
          sortOrder: 0,
          matchTourType: null,
          matchMainTourThemeId: null,
          defaults: {},
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString()
        }),
        remove: async () => undefined,
        reorder: async () => []
      }
    },
    {
      provide: TenantBootstrapService,
      useValue: {
        resolveTenantFromTourId: async () => "00000000-0000-4000-8000-000000000000"
      }
    },
    { provide: RegistrationsService, useValue: {} },
    { provide: PaymentsService, useValue: {} },
    { provide: UsersReadService, useValue: {} },
    { provide: UsersWriteService, useValue: {} },
    { provide: UsersAuditService, useValue: {} },
    { provide: UsersInviteService, useValue: {} },
    {
      provide: MeService,
      useValue: {
        getMe: async () => ({
          id: "00000000-0000-4000-8000-000000000099",
          full_name: "OpenAPI User",
          national_id: null,
          gender: null,
          birth_date: null,
          email: "openapi@example.com",
          is_email_verified: true,
          phone: "+989000000000",
          is_phone_verified: true,
          notifications_enabled: true,
          profile_row_version: 1
        }),
        patchMe: async () => ({
          id: "00000000-0000-4000-8000-000000000099",
          full_name: "OpenAPI User",
          national_id: null,
          gender: null,
          birth_date: null,
          email: "openapi@example.com",
          is_email_verified: true,
          phone: "+989000000000",
          is_phone_verified: true,
          notifications_enabled: true,
          profile_row_version: 2
        }),
        verifyEmail: async () => ({ status: "email_verified" as const, email: "openapi@example.com" }),
        requestChangeMobile: async () => ({
          challenge_id: "00000000-0000-4000-8000-0000000000aa"
        }),
        verifyChangeMobile: async () => ({ status: "mobile_changed" as const, mobile: "+989000000000" })
      }
    },
    { provide: IdempotencyService, useValue: {} },
    {
      provide: OutboxMetricsService,
      useValue: {
        getSnapshot: () => ({
          outbox_pending_total: 0,
          outbox_failed_total: 0,
          outbox_processing_latency_ms: 0,
          last_batch_processed_at: null
        })
      }
    },
    {
      provide: ObservabilityMetricsService,
      useValue: {
        getPrometheusText: () => "",
        getSecurityMetricsSnapshot: () => ({
          tenant_resolution_failures_total: {},
          auth_login_failures_total: 0,
          tenant_mismatch_total: 0,
          security_events_total: {},
          metric_alert_trace_hints: []
        })
      }
    },
    {
      provide: TenantAbuseMetricsService,
      useValue: {
        getPrometheusText: () => "",
        getSnapshot: () => ({
          tenant_rate_limit_exceeded_total: {},
          tenant_request_volume_total: 0,
          tenant_request_volume_sample_top: []
        })
      }
    },
    {
      provide: ReconciliationService,
      useValue: {
        getSnapshot: () => ({
          lastRunAt: null,
          lastReconciliationAt: null,
          lastRunHadDrift: false,
          promotedInLastRun: 0,
          totalDriftsDetected: 0,
          totalCorrectionsApplied: 0,
          totalPromotionsTriggered: 0
        })
      }
    },
    {
      provide: SchedulerRuntimeMetricsService,
      useValue: {
        getSnapshot: () => ({})
      }
    },
    {
      provide: TenantUsageMeteringService,
      useValue: {
        getSnapshot: () => ({
          tenant_usage_updates_total: 0,
          tenant_quota_exceeded_total: 0,
          tenant_quota_exceeded_by_scope: {}
        })
      }
    },
    ThrottlerGuard
  ]
})
export class DocumentationModule {}
