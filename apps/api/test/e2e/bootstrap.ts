import "reflect-metadata";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
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

function applyEnvFile(path: string, onlyIfMissing: boolean): void {
  const content = readFileSync(path, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (onlyIfMissing && key in process.env) {
      continue;
    }
    process.env[key] = value;
  }
}

/** Defaults from `.env.test.example`, then optional `.env.test` overrides (keys present in that file). */
function loadDotEnvTest(): void {
  const examplePath = resolve(process.cwd(), ".env.test.example");
  const envPath = resolve(process.cwd(), ".env.test");
  if (existsSync(examplePath)) {
    applyEnvFile(examplePath, true);
  }
  if (existsSync(envPath)) {
    applyEnvFile(envPath, true);
  }
  if (!process.env.TENANT_ROOT_DOMAIN?.trim()) {
    process.env.TENANT_ROOT_DOMAIN = "localhost";
  }
  if (
    !process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET ||
    process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET.trim().length < 16
  ) {
    process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET =
      "test-webhook-hmac-secret-at-least-32chars!!!!";
  }
}

export async function createE2EApp(): Promise<INestApplication> {
  loadDotEnvTest();
  const { startTracing } = await import("../../src/tracing");
  startTracing();

  // DI-DIAGNOSTIC: E2E uses runtime transpilation (tsx); if decorator metadata is not preserved, Nest constructor DI can instantiate classes with undefined dependencies.
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule]
  }).compile();

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
