import "reflect-metadata";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function generateOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const config = new DocumentBuilder()
    .setTitle("API v2 Documentation")
    .setVersion("2.0.0")
    .addServer("/api/v2")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  writeFileSync(
    join(process.cwd(), "openapi.json"),
    JSON.stringify(document, null, 2)
  );
  await app.close();
}

generateOpenApi().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.stack ?? error.message : String(error)
  );
  process.exit(1);
});
