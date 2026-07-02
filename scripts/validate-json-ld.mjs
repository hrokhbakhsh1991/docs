#!/usr/bin/env node
/**
 * SEO-5 — validate golden JSON-LD fixtures per guestSeo richResultsProfile.
 * @see docs/dev/guest-seo-conformance.md
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES_DIR = path.join(REPO_ROOT, "scripts/test/fixtures/jsonld");
const MANIFEST_GOLDEN = path.join(REPO_ROOT, "scripts/test/fixtures/workspace-guest-seo.golden.json");
const SDK_DIST = path.join(REPO_ROOT, "packages/workspace-sdk/dist/index.js");

const require = createRequire(import.meta.url);

/** @type {Record<string, (json: Record<string, unknown>) => string[]>} */
const PROFILE_RULES = {
  "tourist-trip-v1": (json) => {
    const errors = [];
    if (json["@type"] !== "TouristTrip") {
      errors.push("EXPECTED_TOURIST_TRIP");
    }
    if (typeof json.name !== "string" || json.name.trim().length === 0) {
      errors.push("NAME_REQUIRED");
    }
    if (json.offers !== undefined) {
      const offers = json.offers;
      if (typeof offers !== "object" || offers === null || Array.isArray(offers)) {
        errors.push("OFFERS_MUST_BE_OBJECT");
      } else       if (offers["@type"] !== "Offer") {
        errors.push("OFFERS_TYPE");
      } else if (
        offers.availability !== undefined &&
        typeof offers.availability !== "string"
      ) {
        errors.push("OFFERS_AVAILABILITY_TYPE");
      }
    }
    return errors;
  },
  "event-v1": (json) => {
    const errors = [];
    if (json["@type"] !== "Event") {
      errors.push("EXPECTED_EVENT");
    }
    if (typeof json.startDate !== "string" || json.startDate.trim().length === 0) {
      errors.push("START_DATE_REQUIRED");
    }
    if (typeof json.endDate !== "string" || json.endDate.trim().length === 0) {
      errors.push("END_DATE_REQUIRED");
    }
    if (typeof json.image !== "string" || json.image.trim().length === 0) {
      errors.push("IMAGE_REQUIRED");
    }
    if (typeof json.eventStatus !== "string" || json.eventStatus.trim().length === 0) {
      errors.push("EVENT_STATUS_REQUIRED");
    }
    if (typeof json.eventAttendanceMode !== "string" || json.eventAttendanceMode.trim().length === 0) {
      errors.push("EVENT_ATTENDANCE_MODE_REQUIRED");
    }
    return errors;
  },
  "event-stub-v1": (json) => {
    const errors = [];
    if (json["@type"] !== "Event") {
      errors.push("EXPECTED_EVENT");
    }
    if (typeof json.name !== "string" || json.name.trim().length === 0) {
      errors.push("NAME_REQUIRED");
    }
    if (typeof json.eventStatus !== "string" || json.eventStatus.trim().length === 0) {
      errors.push("EVENT_STATUS_REQUIRED");
    }
    return errors;
  },
};

function loadValidateStructuredData() {
  if (!existsSync(SDK_DIST)) {
    console.error(
      "validate-json-ld: build workspace-sdk first (pnpm --filter @app-tour/workspace-sdk run build)"
    );
    process.exit(1);
  }
  const sdk = require(SDK_DIST);
  if (typeof sdk.validateStructuredData !== "function") {
    console.error("validate-json-ld: workspace-sdk dist missing validateStructuredData export");
    process.exit(1);
  }
  return sdk.validateStructuredData;
}

/**
 * @param {string} profileId
 * @param {unknown} json
 * @param {(json: unknown) => { valid: boolean; errors: string[] }} validateStructuredData
 */
function validateProfileFixture(profileId, json, validateStructuredData) {
  const errors = [];
  const base = validateStructuredData(json);
  if (!base.ok) {
    errors.push(...base.errors.map((code) => `SDK:${code}`));
  }

  const rule = PROFILE_RULES[profileId];
  if (rule === undefined) {
    errors.push(`UNKNOWN_PROFILE:${profileId}`);
    return errors;
  }

  if (typeof json === "object" && json !== null && !Array.isArray(json)) {
    errors.push(...rule(/** @type {Record<string, unknown>} */ (json)));
  }

  return errors;
}

function listFixtureProfiles() {
  return readdirSync(FIXTURES_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.replace(/\.json$/, ""));
}

function assertManifestProfilesHaveFixtures() {
  const manifestGolden = JSON.parse(readFileSync(MANIFEST_GOLDEN, "utf8"));
  const fixtureProfiles = new Set(listFixtureProfiles());
  const errors = [];

  for (const [workspaceId, profile] of Object.entries(manifestGolden)) {
    const richResultsProfile = /** @type {{ richResultsProfile?: string }} */ (profile)
      .richResultsProfile;
    if (richResultsProfile === undefined) {
      continue;
    }
    if (!fixtureProfiles.has(richResultsProfile)) {
      errors.push(`${workspaceId}: missing fixture for profile ${richResultsProfile}`);
    }
  }

  return errors;
}

function runAllFixtures(validateStructuredData) {
  const errors = [];
  errors.push(...assertManifestProfilesHaveFixtures());

  for (const profileId of listFixtureProfiles()) {
    const fixturePath = path.join(FIXTURES_DIR, `${profileId}.json`);
    let json;
    try {
      json = JSON.parse(readFileSync(fixturePath, "utf8"));
    } catch (error) {
      errors.push(`${profileId}: invalid JSON (${String(error)})`);
      continue;
    }

    const profileErrors = validateProfileFixture(profileId, json, validateStructuredData);
    for (const code of profileErrors) {
      errors.push(`${profileId}: ${code}`);
    }
  }

  return errors;
}

function main() {
  const validateStructuredData = loadValidateStructuredData();
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: node scripts/validate-json-ld.mjs [--all-fixtures] [--profile <id>]");
    process.exit(0);
  }

  if (args.includes("--all-fixtures") || args.length === 0) {
    const errors = runAllFixtures(validateStructuredData);
    if (errors.length > 0) {
      console.error("validate-json-ld: FAIL");
      for (const error of errors) {
        console.error(` - ${error}`);
      }
      process.exit(1);
    }
    console.log(`validate-json-ld: PASS (${listFixtureProfiles().length} profiles)`);
    return;
  }

  const profileIndex = args.indexOf("--profile");
  if (profileIndex === -1 || profileIndex === args.length - 1) {
    console.error("validate-json-ld: --profile <id> required when not using --all-fixtures");
    process.exit(1);
  }

  const profileId = args[profileIndex + 1];
  const fixturePath = path.join(FIXTURES_DIR, `${profileId}.json`);
  if (!existsSync(fixturePath)) {
    console.error(`validate-json-ld: fixture not found for profile ${profileId}`);
    process.exit(1);
  }

  const json = JSON.parse(readFileSync(fixturePath, "utf8"));
  const errors = validateProfileFixture(profileId, json, validateStructuredData);
  if (errors.length > 0) {
    console.error(`validate-json-ld: FAIL (${profileId})`);
    for (const error of errors) {
      console.error(` - ${error}`);
    }
    process.exit(1);
  }

  console.log(`validate-json-ld: PASS (${profileId})`);
}

main();
