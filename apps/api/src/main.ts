import "reflect-metadata";
import { shutdownTracing, startTracing } from "./tracing";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Logger, ShutdownSignal, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import express from "express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/errors/global-exception.filter";
import { LoggerService } from "./common/logger/logger.service";
import { ObservabilityMetricsService } from "./common/observability/observability-metrics.service";
import { AuthMiddleware } from "./common/middleware/auth.middleware";
import { RequestContextMiddleware } from "./common/request-context/request-context.middleware";
import { RequestTraceMiddleware } from "./common/observability/request-trace.middleware";
import { RequestContextService } from "./common/request-context/request-context.service";
import { TenantRateLimitMiddleware } from "./common/tenant-abuse/tenant-rate-limit.middleware";
import { TenantUsageMiddleware } from "./common/billing/tenant-usage.middleware";
import { TenantMiddleware } from "./common/tenant/tenant.middleware";
import { TenantResolverMiddleware } from "./common/tenant/tenant-resolver.middleware";
import { ConfigService } from "./config/config.service";

async function bootstrap() {
  startTracing();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false
  });

  app.use(
    express.json({
      limit: "2mb",
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      }
    })
  );
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));

  // Docker/Compose stop uses SIGTERM; handle it explicitly so we call app.close() then exit 0.
  // Other shutdown signals stay on Nest's enableShutdownHooks path (no duplicate listeners).
  const dockerShutdownSignals = new Set<string>([
    ShutdownSignal.SIGTERM,
    ShutdownSignal.SIGINT
  ]);
  app.enableShutdownHooks(
    Object.values(ShutdownSignal).filter(
      (signal) => !dockerShutdownSignals.has(signal)
    )
  );

  const configService = app.get(ConfigService);
  app.set("trust proxy", configService.getTrustProxySetting());
  // Swagger UI serves inline scripts; default Helmet CSP blocks it.
  app.use(helmet({ contentSecurityPolicy: false }));

  app.enableCors({
    origin: (origin, callback) => {
      if (configService.isCorsOriginAllowed(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true
  });

  const requestContextMiddleware = app.get(RequestContextMiddleware);
  app.use(requestContextMiddleware.use.bind(requestContextMiddleware));
  const tenantResolverMiddleware = app.get(TenantResolverMiddleware);
  app.use(tenantResolverMiddleware.use.bind(tenantResolverMiddleware));
  const authMiddleware = app.get(AuthMiddleware);
  app.use(authMiddleware.use.bind(authMiddleware));
  const tenantMiddleware = app.get(TenantMiddleware);
  app.use(tenantMiddleware.use.bind(tenantMiddleware));
  const requestTraceMiddleware = app.get(RequestTraceMiddleware);
  app.use(requestTraceMiddleware.use.bind(requestTraceMiddleware));
  const tenantRateLimitMiddleware = app.get(TenantRateLimitMiddleware);
  app.use(tenantRateLimitMiddleware.use.bind(tenantRateLimitMiddleware));
  const tenantUsageMiddleware = app.get(TenantUsageMiddleware);
  app.use(tenantUsageMiddleware.use.bind(tenantUsageMiddleware));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  const loggerService = app.get(LoggerService);
  const requestContextService = app.get(RequestContextService);
  const observabilityMetrics = app.get(ObservabilityMetricsService);
  app.useGlobalFilters(
    new GlobalExceptionFilter(loggerService, requestContextService, observabilityMetrics)
  );
  const swaggerConfig = new DocumentBuilder()
    .setTitle("API v2 Documentation")
    .setVersion("2.0.0")
    .addServer("/api/v2")
    .addApiKey(
      {
        type: "apiKey",
        in: "header",
        name: "X-Internal-Api-Key",
        description: "Internal API key for protected internal endpoints."
      },
      "internalApiKey"
    )
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, swaggerDocument);
  writeFileSync(
    join(process.cwd(), "openapi.json"),
    JSON.stringify(swaggerDocument, null, 2)
  );
  await app.listen(configService.getPort());

  const gracefulShutdown = async (signal: NodeJS.Signals) => {
    let exitCode = 0;
    try {
      await app.close();
    } catch (err) {
      Logger.error(
        `Graceful shutdown failed (${signal})`,
        err instanceof Error ? err.stack : String(err),
        "Bootstrap"
      );
      exitCode = 1;
    } finally {
      await shutdownTracing();
    }
    process.exit(exitCode);
  };

  process.once("SIGTERM", () => void gracefulShutdown("SIGTERM"));
  process.once("SIGINT", () => void gracefulShutdown("SIGINT"));
}

bootstrap().catch((err: unknown) => {
  Logger.error(
    "Bootstrap failed",
    err instanceof Error ? err.stack ?? err.message : String(err),
    "Bootstrap"
  );
  process.exit(1);
});
