import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { LoggerModule } from "../logger/logger.module";
import { HttpObservabilityInterceptor } from "./http-observability.interceptor";
import { ObservabilityMetricsService } from "./observability-metrics.service";
import { TracingService } from "./tracing.service";

@Global()
@Module({
  imports: [LoggerModule],
  providers: [
    ObservabilityMetricsService,
    TracingService,
    HttpObservabilityInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useExisting: HttpObservabilityInterceptor
    }
  ],
  exports: [ObservabilityMetricsService, TracingService]
})
export class ObservabilityModule {}
