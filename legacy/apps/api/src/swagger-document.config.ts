import { DocumentBuilder } from "@nestjs/swagger";

/** Single DocumentBuilder configuration for runtime Swagger UI and committed `openapi.json`. */
export function configureSwaggerDocumentBuilder(): DocumentBuilder {
  return new DocumentBuilder()
    .setTitle("API v2 Documentation")
    .setVersion("2.0.0")
    .addServer("/api/v2")
    .addBearerAuth(
      { type: "http", scheme: "bearer", bearerFormat: "JWT", in: "header" },
      "bearer",
    )
    .addApiKey(
      {
        type: "apiKey",
        in: "header",
        name: "X-Internal-Api-Key",
        description: "Internal API key for protected internal endpoints.",
      },
      "internalApiKey",
    );
}
