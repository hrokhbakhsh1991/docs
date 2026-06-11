#!/usr/bin/env node
/**
 * DEC-099 — generate OpenAPI 3.1 from dispatch route inventory.
 * @see docs/phase-5/appendices/openapi-dispatch-contract.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "openapi");
const OUT_FILE = path.join(OUT_DIR, "openapi.json");

const { DISPATCH_ROUTES } = await import(
  pathToFileURL(path.join(ROOT, "src/openapi/dispatch-routes.ts")).href
);

const { PUBLIC_AUTH_OPENAPI_OVERRIDES } = await import(
  pathToFileURL(path.join(ROOT, "src/openapi/public-auth-openapi.ts")).href
);

const DEFAULT_RESPONSES = {
  200: { description: "Success" },
  201: { description: "Created" },
  400: { description: "Client error" },
  401: { description: "Unauthorized" },
  403: { description: "Forbidden" },
  404: { description: "Not found" },
  409: { description: "Conflict" },
  429: { description: "Rate limited" },
  503: { description: "Unavailable (pool, shutdown, circuit)" },
};

function toOpenApiPath(routePath) {
  return routePath.replace(/\{([^}]+)\}/g, "{$1}");
}

const paths = {};

for (const route of DISPATCH_ROUTES) {
  const oasPath = toOpenApiPath(route.path);
  paths[oasPath] ??= {};
  const override = PUBLIC_AUTH_OPENAPI_OVERRIDES[route.operationId] ?? {};
  const overrideResponses =
    override.responses !== undefined && typeof override.responses === "object"
      ? override.responses
      : {};
  const { responses: _ignoredResponses, ...overrideRest } = override;

  paths[oasPath][route.method.toLowerCase()] = {
    operationId: route.operationId,
    summary: route.summary,
    ...(route.internal ? { "x-internal": true } : {}),
    ...overrideRest,
    responses: {
      ...DEFAULT_RESPONSES,
      ...overrideResponses,
    },
  };
}

const spec = {
  openapi: "3.1.0",
  info: {
    title: "@apps/api thin HTTP dispatch",
    version: "0.1.0",
    description:
      "Machine-readable contract for createRequestListener routes. Not the legacy Nest openapi.json.",
  },
  servers: [{ url: "http://127.0.0.1:3001" }],
  paths,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
console.log(`openapi:generate: wrote ${OUT_FILE} (${DISPATCH_ROUTES.length} routes)`);
