import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit
} from "@nestjs/common";
import { ConfigService } from "../../config/config.service";
import { ReconciliationService } from "./reconciliation.service";

@Injectable()
export class ReconciliationProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReconciliationProcessor.name);
  private interval?: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService,
    private readonly reconciliationService: ReconciliationService
  ) {}

  onModuleInit(): void {
    if (!this.configService.getReconciliationEnabled()) {
      return;
    }
    const ms = this.configService.getReconciliationIntervalMs();
    this.interval = setInterval(() => {
      void this.reconciliationService.runReconciliationCycle().catch((error: unknown) => {
        this.logger.warn(`reconciliation cycle failed: ${String(error)}`);
      });
    }, ms);
    this.interval.unref?.();
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }
}
