import { Inject, Injectable } from "@nestjs/common";
import pino, { type Logger } from "pino";
import { tryGetActiveTraceLogFields } from "../observability/active-trace-log-fields";
import { RequestContextService } from "../request-context/request-context.service";
import { ConfigService } from "../../config/config.service";

type LogMeta = Record<string, unknown>;

@Injectable()
export class LoggerService {
  private readonly logger: Logger;

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService
  ) {
    this.logger = pino({
      level: this.configService.getLogLevel(),
      timestamp: pino.stdTimeFunctions.isoTime
    });
  }

  debug(message: string, meta: LogMeta = {}): void {
    this.logger.debug(this.withRequestContext(meta), message);
  }

  info(message: string, meta: LogMeta = {}): void {
    this.logger.info(this.withRequestContext(meta), message);
  }

  warn(message: string, meta: LogMeta = {}): void {
    this.logger.warn(this.withRequestContext(meta), message);
  }

  error(message: string, meta: LogMeta = {}): void {
    this.logger.error(this.withRequestContext(meta), message);
  }

  private withRequestContext(meta: LogMeta): LogMeta {
    const traceFields = tryGetActiveTraceLogFields();
    const ctx = this.requestContextService.tryGetStructuredLogContext();
    return {
      ...(traceFields ?? {}),
      ...(ctx ?? {}),
      ...meta
    };
  }
}
