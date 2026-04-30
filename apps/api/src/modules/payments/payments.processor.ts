import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit
} from "@nestjs/common";
import { ConfigService } from "../../config/config.service";
import { PaymentsService } from "./payments.service";

@Injectable()
export class PaymentsProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentsProcessor.name);
  private interval?: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService,
    private readonly paymentsService: PaymentsService
  ) {}

  onModuleInit(): void {
    if (!this.configService.getPaymentsTimeoutEnabled()) {
      return;
    }
    const ms = this.configService.getPaymentsTimeoutIntervalMs();
    this.interval = setInterval(() => {
      void this.paymentsService.failTimedOutPendingPayments().catch((error: unknown) => {
        this.logger.warn(`payments timeout run failed: ${String(error)}`);
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
