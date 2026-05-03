import "reflect-metadata";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../../src/app.module";
import { GlobalExceptionFilter } from "../../src/common/errors/global-exception.filter";
import { LoggerService } from "../../src/common/logger/logger.service";
import { AuthMiddleware } from "../../src/common/middleware/auth.middleware";
import { RequestContextMiddleware } from "../../src/common/request-context/request-context.middleware";
import { RequestContextService } from "../../src/common/request-context/request-context.service";
import { TenantMiddleware } from "../../src/common/tenant/tenant.middleware";

function loadDotEnvTest(): void {
  const envPath = resolve(process.cwd(), ".env.test");
  if (!existsSync(envPath)) {
    return;
  }
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

export async function createE2EApp(): Promise<INestApplication> {
  loadDotEnvTest();

  // DI-DIAGNOSTIC: E2E uses runtime transpilation (tsx); if decorator metadata is not preserved, Nest constructor DI can instantiate classes with undefined dependencies.
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule]
  }).compile();

  const app = moduleRef.createNestApplication();

  // Align middleware/bootstrap with production runtime pipeline.
  // DI-DIAGNOSTIC: app.get(...) here validates provider availability at app container level; failures indicate module-scope registration/export issues.
  const requestContextMiddleware = app.get(RequestContextMiddleware);
  app.use(requestContextMiddleware.use.bind(requestContextMiddleware));
  const authMiddleware = app.get(AuthMiddleware);
  app.use(authMiddleware.use.bind(authMiddleware));
  const tenantMiddleware = app.get(TenantMiddleware);
  app.use(tenantMiddleware.use.bind(tenantMiddleware));

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
  app.useGlobalFilters(new GlobalExceptionFilter(loggerService, requestContextService));

  await app.init();
  return app;
}
