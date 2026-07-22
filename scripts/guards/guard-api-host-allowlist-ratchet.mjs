#!/usr/bin/env node
/**
 * API host-import allowlist ratchet — forbid new legacy allowlist entries.
 * Current allowlist must be ⊆ CEILING and size ≤ MAX.
 * @see docs/dev/saas-platform-remediation.mdoc
 */
import {
  HOST_IMPORT_LEGACY_ALLOWLIST,
  HOST_IMPORT_LEGACY_ALLOWLIST_CEILING,
  HOST_IMPORT_LEGACY_ALLOWLIST_MAX,
} from "./lib/api-host-import-allowlist.mjs";

const ceiling = new Set(HOST_IMPORT_LEGACY_ALLOWLIST_CEILING);
/** @type {string[]} */
const additions = [];
for (const entry of HOST_IMPORT_LEGACY_ALLOWLIST) {
  if (!ceiling.has(entry)) {
    additions.push(entry);
  }
}

const size = HOST_IMPORT_LEGACY_ALLOWLIST.size;
/** @type {string[]} */
const errors = [];

if (size > HOST_IMPORT_LEGACY_ALLOWLIST_MAX) {
  errors.push(
    `allowlist size ${size} exceeds budget ${HOST_IMPORT_LEGACY_ALLOWLIST_MAX}`
  );
}

if (additions.length > 0) {
  errors.push(
    `new allowlist entries not in Phase A ceiling (${additions.length}): ${additions.join(", ")}`
  );
}

if (HOST_IMPORT_LEGACY_ALLOWLIST_CEILING.length > HOST_IMPORT_LEGACY_ALLOWLIST_MAX) {
  errors.push(
    `ceiling length ${HOST_IMPORT_LEGACY_ALLOWLIST_CEILING.length} exceeds MAX ${HOST_IMPORT_LEGACY_ALLOWLIST_MAX} — charter edit required`
  );
}

if (errors.length > 0) {
  console.error("guard-api-host-allowlist-ratchet: FAIL");
  console.error("  Shrink allowlist via codegen/bindings; do not grow. See docs/dev/saas-platform-remediation.mdoc");
  for (const e of errors) {
    console.error(`  - ${e}`);
  }
  process.exit(1);
}

console.log(
  `guard-api-host-allowlist-ratchet: PASS (size=${size} max=${HOST_IMPORT_LEGACY_ALLOWLIST_MAX}; ⊆ ceiling)`
);
