import "reflect-metadata";
import { loadDotEnvTest } from "@repo/testing-infra";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, type TestingModuleBuilder } from "@nestjs/testing";
import { NestExpressApplication } from "@nestjs/platform-express";
import express from "express";
import { AppModule } from "../../src/app.module";
import { GlobalExceptionFilter } from "../../src/common/errors/global-exception.filter";
import { LoggerService } from "../../src/common/logger/logger.service";
import { ObservabilityMetricsService } from "../../src/common/observability/observability-metrics.service";
import { AuthMiddleware } from "../../src/common/middleware/auth.middleware";
import { RequestContextMiddleware } from "../../src/common/request-context/request-context.middleware";
import { RequestContextService } from "../../src/common/request-context/request-context.service";
import { TenantRateLimitMiddleware } from "../../src/common/tenant-abuse/tenant-rate-limit.middleware";
import { TenantMiddleware } from "../../src/common/tenant/tenant.middleware";
import { TenantResolverMiddleware } from "../../src/common/tenant/tenant-resolver.middleware";

export async function createE2EApp(
  configure?: (_builder: TestingModuleBuilder) => TestingModuleBuilder
): Promise<INestApplication> {
  loadDotEnvTest();
  const { startTracing } = await import("../../src/tracing");
  startTracing();

  // DI-DIAGNOSTIC: E2E uses runtime transpilation (tsx); if decorator metadata is not preserved, Nest constructor DI can instantiate classes with undefined dependencies.
  let builder = Test.createTestingModule({
    imports: [AppModule]
  });
  if (configure) {
    builder = configure(builder);
  }
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({
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

  // Align middleware/bootstrap with production runtime pipeline.
  // DI-DIAGNOSTIC: app.get(...) here validates provider availability at app container level; failures indicate module-scope registration/export issues.
  const requestContextMiddleware = app.get(RequestContextMiddleware);
  app.use(requestContextMiddleware.use.bind(requestContextMiddleware));
  const tenantResolverMiddleware = app.get(TenantResolverMiddleware);
  app.use(tenantResolverMiddleware.use.bind(tenantResolverMiddleware));
  const authMiddleware = app.get(AuthMiddleware);
  app.use(authMiddleware.use.bind(authMiddleware));
  const tenantMiddleware = app.get(TenantMiddleware);
  app.use(tenantMiddleware.use.bind(tenantMiddleware));
  const tenantRateLimitMiddleware = app.get(TenantRateLimitMiddleware);
  app.use(tenantRateLimitMiddleware.use.bind(tenantRateLimitMiddleware));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true
    })
  );

  const loggerService = app.get(LoggerService);
  // DI-DIAGNOSTIC: RequestContextService may resolve from DI but still fail at runtime if request context store is not initialized for a request path.
  const requestContextService = app.get(RequestContextService);
  const observabilityMetrics = app.get(ObservabilityMetricsService);
  app.useGlobalFilters(
    new GlobalExceptionFilter(loggerService, requestContextService, observabilityMetrics)
  );

  await app.init();
  return app;
}
