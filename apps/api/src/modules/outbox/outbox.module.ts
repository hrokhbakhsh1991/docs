import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OutboxEventEntity } from "./entities/outbox-event.entity";
import { OutboxService } from "./outbox.service";
import { OutboxProcessor } from "./outbox.processor";
import { OutboxMetricsService } from "./outbox-metrics.service";

@Module({
  imports: [TypeOrmModule.forFeature([OutboxEventEntity])],
  providers: [OutboxService, OutboxProcessor, OutboxMetricsService],
  exports: [OutboxService, OutboxMetricsService]
})
export class OutboxModule {}
