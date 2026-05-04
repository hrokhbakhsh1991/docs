import "reflect-metadata";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { DocumentationModule } from "./documentation/documentation.module";

async function generateOpenApi(): Promise<void> {
  const outputPath = join(process.cwd(), "openapi.json");
  const app = await NestFactory.create(DocumentationModule, {
    logger: false,
    abortOnError: false
  });
  try {
    const config = new DocumentBuilder()
      .setTitle("API v2 Documentation")
      .setVersion("2.0.0")
      .addServer("/api/v2")
      .build();
    const document = SwaggerModule.createDocument(app, config);
    writeFileSync(outputPath, JSON.stringify(document, null, 2));
  } finally {
    await app.close();
  }
}

generateOpenApi().catch((error: unknown) => {
  console.error(
    "[openapi] generation failed. Check controller/provider wiring in DocumentationModule."
  );
  console.error(
    error instanceof Error ? error.stack ?? error.message : String(error)
  );
  process.exit(1);
});
