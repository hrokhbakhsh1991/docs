import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DatabaseModule } from "../../database/database.module";
import { OutboxEventEntity } from "./entities/outbox-event.entity";
import { OutboxRelayWorker } from "../../common/outbox/outbox-relay-worker";
import { OutboxService } from "./outbox.service";
import { OutboxProcessor } from "./outbox.processor";
import { OutboxMetricsService } from "./outbox-metrics.service";

@Module({
  imports: [TypeOrmModule.forFeature([OutboxEventEntity]), DatabaseModule],
  providers: [OutboxService, OutboxProcessor, OutboxMetricsService, OutboxRelayWorker],
  exports: [OutboxService, OutboxMetricsService, OutboxRelayWorker]
})
export class OutboxModule {}
