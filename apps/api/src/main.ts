import "reflect-metadata";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/errors/global-exception.filter";
import { LoggerService } from "./common/logger/logger.service";
import { AuthMiddleware } from "./common/middleware/auth.middleware";
import { RequestContextMiddleware } from "./common/request-context/request-context.middleware";
import { RequestContextService } from "./common/request-context/request-context.service";
import { TenantMiddleware } from "./common/tenant/tenant.middleware";
import { ConfigService } from "./config/config.service";

async function bootstrap() {
  setInterval(() => {
    const m = process.memoryUsage();
    console.log(
      `[MEMORY] rss=${(m.rss / 1024 / 1024).toFixed(0)}MB heapUsed=${(m.heapUsed / 1024 / 1024).toFixed(0)}MB heapTotal=${(m.heapTotal / 1024 / 1024).toFixed(0)}MB`
    );
  }, 5000);

  const app = await NestFactory.create(AppModule);
  const requestContextMiddleware = app.get(RequestContextMiddleware);
  app.use(requestContextMiddleware.use.bind(requestContextMiddleware));
  const authMiddleware = app.get(AuthMiddleware);
  app.use(authMiddleware.use.bind(authMiddleware));
  const tenantMiddleware = app.get(TenantMiddleware);
  app.use(tenantMiddleware.use.bind(tenantMiddleware));
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
  const configService = app.get(ConfigService);
  await app.listen(configService.getPort());
}

bootstrap();
