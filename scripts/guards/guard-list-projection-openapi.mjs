#!/usr/bin/env node
/**
 * List projection OpenAPI guard — list endpoints must declare bounded response schemas
 * without internal JSON blobs (`registrationIntake`, `canonical`, etc.).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OPENAPI_PATH = path.join(REPO_ROOT, "apps/api/openapi/openapi.json");

const FORBIDDEN_FIELDS = new Set([
  "registrationIntake",
  "registration_intake",
  "canonical",
  "data",
]);

const REQUIRED_OPERATIONS = [
  { operationId: "listBookings", schema: "BookingsListResponse" },
  { operationId: "getBookingsSummary", schema: "BookingsSummaryResponse" },
  { operationId: "listTours", schema: "ToursListResponse" },
];

const REQUIRED_COMPONENT_SCHEMAS = [
  "BookingListItem",
  "BookingsListResponse",
  "BookingsSummaryResponse",
  "ToursListResponse",
];

/**
 * @param {unknown} schema
 * @param {string} label
 * @param {Set<string>} visitedRefs
 * @returns {string[]}
 */
function collectForbiddenFields(schema, label, visitedRefs = new Set()) {
  if (schema === null || typeof schema !== "object") {
    return [];
  }

  /** @type {Record<string, unknown>} */
  const node = schema;
  const violations = [];

  if (typeof node.$ref === "string") {
    if (visitedRefs.has(node.$ref)) {
      return violations;
    }
    visitedRefs.add(node.$ref);
  }

  if (node.properties !== undefined && typeof node.properties === "object") {
    for (const key of Object.keys(node.properties)) {
      if (FORBIDDEN_FIELDS.has(key)) {
        violations.push(`${label}: forbidden property "${key}"`);
      }
    }
  }

  if (node.additionalProperties === true) {
    violations.push(`${label}: additionalProperties must not be true on list schemas`);
  }

  if (Array.isArray(node.oneOf)) {
    for (const [index, child] of node.oneOf.entries()) {
      violations.push(...collectForbiddenFields(child, `${label}.oneOf[${index}]`, visitedRefs));
    }
  }

  if (node.items !== undefined) {
    violations.push(...collectForbiddenFields(node.items, `${label}.items`, visitedRefs));
  }

  return violations;
}

/**
 * @param {Record<string, unknown>} spec
 * @param {string} ref
 */
function resolveRef(spec, ref) {
  if (!ref.startsWith("#/components/schemas/")) {
    return null;
  }
  const name = ref.slice("#/components/schemas/".length);
  const schemas = spec.components?.schemas;
  if (schemas === undefined || typeof schemas !== "object") {
    return null;
  }
  return schemas[name] ?? null;
}

/**
 * @param {Record<string, unknown>} spec
 * @param {unknown} schema
 * @param {Set<string>} visited
 */
function expandSchema(spec, schema, visited = new Set()) {
  if (schema === null || typeof schema !== "object") {
    return schema;
  }
  /** @type {Record<string, unknown>} */
  const node = schema;
  if (typeof node.$ref === "string") {
    if (visited.has(node.$ref)) {
      return node;
    }
    visited.add(node.$ref);
    const resolved = resolveRef(spec, node.$ref);
    if (resolved === null) {
      return node;
    }
    return expandSchema(spec, resolved, visited);
  }
  return node;
}

/**
 * @param {Record<string, unknown>} spec
 * @param {string} operationId
 */
function responseSchemaRef(spec, operationId) {
  const paths = spec.paths;
  if (paths === undefined || typeof paths !== "object") {
    return null;
  }
  for (const methods of Object.values(paths)) {
    if (methods === null || typeof methods !== "object") {
      continue;
    }
    for (const operation of Object.values(methods)) {
      if (operation === null || typeof operation !== "object") {
        continue;
      }
      if (operation.operationId !== operationId) {
        continue;
      }
      const schema = operation.responses?.["200"]?.content?.["application/json"]?.schema;
      if (schema === undefined || schema === null || typeof schema !== "object") {
        return null;
      }
      if (typeof schema.$ref === "string") {
        return schema.$ref;
      }
      const expanded = expandSchema(spec, schema);
      if (expanded !== null && typeof expanded === "object" && typeof expanded.$ref === "string") {
        return expanded.$ref;
      }
      return null;
    }
  }
  return null;
}

/** @type {string[]} */
const violations = [];

if (!fs.existsSync(OPENAPI_PATH)) {
  console.error("guard-list-projection-openapi: FAIL");
  console.error("  apps/api/openapi/openapi.json missing — run pnpm --filter @apps/api run openapi:generate");
  process.exit(1);
}

const spec = JSON.parse(fs.readFileSync(OPENAPI_PATH, "utf8"));
const schemas = spec.components?.schemas ?? {};

for (const name of REQUIRED_COMPONENT_SCHEMAS) {
  if (schemas[name] === undefined) {
    violations.push(`components.schemas.${name} is missing`);
  }
}

for (const name of REQUIRED_COMPONENT_SCHEMAS) {
  if (schemas[name] !== undefined) {
    violations.push(...collectForbiddenFields(schemas[name], `components.schemas.${name}`));
  }
}

for (const { operationId, schema } of REQUIRED_OPERATIONS) {
  const ref = responseSchemaRef(spec, operationId);
  const expected = `#/components/schemas/${schema}`;
  if (ref !== expected) {
    violations.push(`${operationId} 200 response must $ref ${expected} (got ${ref ?? "none"})`);
  }
}

if (violations.length > 0) {
  console.error("guard-list-projection-openapi: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log("guard-list-projection-openapi: PASS (list endpoints declare blob-free projection schemas)");
