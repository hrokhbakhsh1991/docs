import "reflect-metadata";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";
import { DocumentationModule } from "./documentation/documentation.module";
import { configureSwaggerDocumentBuilder } from "./swagger-document.config";

async function generateOpenApi(): Promise<void> {
  const outputPath = join(process.cwd(), "openapi.json");
  const app = await NestFactory.create(DocumentationModule, {
    logger: false,
    abortOnError: false
  });
  try {
    const config = configureSwaggerDocumentBuilder().build();
    const document = SwaggerModule.createDocument(app, config);
    writeFileSync(outputPath, JSON.stringify(document, null, 2));
  } finally {
    await app.close();
  }
}

generateOpenApi().catch((error: unknown) => {
  process.stderr.write("FATAL: OpenAPI generation failed during pipeline execution.\n");
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exit(1);
});
