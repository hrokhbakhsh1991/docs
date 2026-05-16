import { Global, Module } from "@nestjs/common";
import { LoggerModule } from "../logger/logger.module";
import { RequestTraceMiddleware } from "../observability/request-trace.middleware";
import { RequestContextMiddleware } from "./request-context.middleware";
import { RequestContextService } from "./request-context.service";

@Global()
@Module({
  imports: [LoggerModule],
  providers: [RequestContextService, RequestContextMiddleware, RequestTraceMiddleware],
  exports: [RequestContextService, RequestTraceMiddleware]
})
export class RequestContextModule {}
