#!/usr/bin/env node
/**
 * PF-1.8 — guest extension schema admission guard.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertGuestExtensionsManifest,
  discoverManifests,
} from "../generate-workspace-registry.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCHEMA_PATH = path.join(REPO_ROOT, "docs/dev/workspace-guest-extensions.schema.json");

/** @param {unknown} prop */
function isClosedObjectSchema(prop) {
  if (prop === null || typeof prop !== "object") {
    return false;
  }
  if (/** @type {{ additionalProperties?: boolean }} */ (prop).additionalProperties === false) {
    return true;
  }
  const oneOf = /** @type {{ oneOf?: unknown[] }} */ (prop).oneOf;
  if (Array.isArray(oneOf) && oneOf.length > 0) {
    return oneOf.every(
      (branch) =>
        branch !== null &&
        typeof branch === "object" &&
        /** @type {{ additionalProperties?: boolean }} */ (branch).additionalProperties === false
    );
  }
  return false;
}

/** @type {string[]} */
const violations = [];

if (!fs.existsSync(SCHEMA_PATH)) {
  violations.push("docs/dev/workspace-guest-extensions.schema.json is missing");
} else {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
  if (schema.properties?.guestExtensionsVersion?.const !== 1) {
    violations.push("schema must require guestExtensionsVersion const 1");
  }
  if (schema.properties?.catalogRegistrationFlow?.additionalProperties !== false) {
    violations.push("schema must make catalogRegistrationFlow additionalProperties false");
  }
  if (schema.properties?.catalogPresentation?.additionalProperties !== false) {
    violations.push("schema must make catalogPresentation additionalProperties false");
  }
  if (schema.properties?.memberProfile?.additionalProperties !== false) {
    violations.push("schema must make memberProfile additionalProperties false");
  }
  if (!isClosedObjectSchema(schema.properties?.memberPortal)) {
    violations.push("schema must make memberPortal additionalProperties false");
  }
  if (schema.properties?.guestCrossSurfaceNav?.additionalProperties !== false) {
    violations.push("schema must make guestCrossSurfaceNav additionalProperties false");
  }
  if (schema.properties?.guestSeo?.additionalProperties !== false) {
    violations.push("schema must make guestSeo additionalProperties false");
  }
}

for (const manifest of discoverManifests()) {
  try {
    assertGuestExtensionsManifest(manifest);
  } catch (error) {
    violations.push(error instanceof Error ? error.message : String(error));
  }
}

try {
  assertGuestExtensionsManifest({
    id: "bad-guest-version",
    version: 1,
    package: "@app-tour/workspace-bad",
    workspaceTypes: ["bad-guest-version"],
    plugin: { entry: "./plugin", export: "getBadPlugin" },
    httpRoutes: {
      groups: [
        {
          staticHandlers: {
            "GET /bad-guest-version/catalog": "handleGetBadCatalog",
          },
        },
      ],
    },
  });
  violations.push("missing guestExtensionsVersion did not fail");
} catch (error) {
  if (!/guestExtensionsVersion: 1/.test(error instanceof Error ? error.message : String(error))) {
    violations.push(`unexpected missing-version error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (violations.length > 0) {
  console.error("guard-guest-extension-schema: FAIL");
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-guest-extension-schema: PASS");
