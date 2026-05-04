import "reflect-metadata";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Logger, ShutdownSignal, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/errors/global-exception.filter";
import { LoggerService } from "./common/logger/logger.service";
import { AuthMiddleware } from "./common/middleware/auth.middleware";
import { RequestContextMiddleware } from "./common/request-context/request-context.middleware";
import { RequestContextService } from "./common/request-context/request-context.service";
import { TenantMiddleware } from "./common/tenant/tenant.middleware";
import { ConfigService } from "./config/config.service";

async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    setInterval(() => {
      const m = process.memoryUsage();
      console.log(
        `[MEMORY] rss=${(m.rss / 1024 / 1024).toFixed(0)}MB heapUsed=${(m.heapUsed / 1024 / 1024).toFixed(0)}MB heapTotal=${(m.heapTotal / 1024 / 1024).toFixed(0)}MB`
      );
    }, 5000);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

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

  app.set("trust proxy", 1);
  // Swagger UI serves inline scripts; default Helmet CSP blocks it.
  app.use(helmet({ contentSecurityPolicy: false }));

  const configService = app.get(ConfigService);
  const corsOrigins = configService.getCorsOrigins();
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true
  });

  const requestContextMiddleware = app.get(RequestContextMiddleware);
  app.use(requestContextMiddleware.use.bind(requestContextMiddleware));
  const authMiddleware = app.get(AuthMiddleware);
  app.use(authMiddleware.use.bind(authMiddleware));
  const tenantMiddleware = app.get(TenantMiddleware);
  app.use(tenantMiddleware.use.bind(tenantMiddleware));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  const loggerService = app.get(LoggerService);
  const requestContextService = app.get(RequestContextService);
  app.useGlobalFilters(
    new GlobalExceptionFilter(loggerService, requestContextService)
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
    try {
      await app.close();
    } catch (err) {
      Logger.error(
        `Graceful shutdown failed (${signal})`,
        err instanceof Error ? err.stack : String(err),
        "Bootstrap"
      );
      process.exit(1);
    }
    process.exit(0);
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
