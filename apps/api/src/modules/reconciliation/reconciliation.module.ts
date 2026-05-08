import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DatabaseModule } from "../../database/database.module";
import { TenantUsageModule } from "../../common/billing/tenant-usage.module";
import { TenantAbuseModule } from "../../common/tenant-abuse/tenant-abuse.module";
import { IdentityModule } from "../identity/identity.module";
import { OutboxModule } from "../outbox/outbox.module";
import { RegistrationsModule } from "../registrations/registrations.module";
import { TourEntity } from "../tours/entities/tour.entity";
import { ReconciliationProcessor } from "./reconciliation.processor";
import { ReconciliationService } from "./reconciliation.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([TourEntity]),
    DatabaseModule,
    TenantUsageModule,
    TenantAbuseModule,
    IdentityModule,
    OutboxModule,
    RegistrationsModule
  ],
  providers: [ReconciliationService, ReconciliationProcessor],
  exports: [ReconciliationService]
})
export class ReconciliationModule {}
