/**
 * CW0-01 — reusable golden parity harness (no production behavior).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { stableStringify } from "./stable-json.mjs";

/**
 * @param {string} fixturePath
 * @returns {unknown}
 */
export function loadFixture(fixturePath) {
  const raw = readFileSync(fixturePath, "utf8");
  return JSON.parse(raw);
}

/**
 * @param {{
 *   readonly id: string;
 *   readonly run: (input: unknown) => unknown;
 *   readonly fixturePath: string;
 * }} params
 */
export function assertGoldenParity(params) {
  const fixture = loadFixture(params.fixturePath);
  assert.equal(fixture.id, params.id, `fixture id mismatch for ${params.fixturePath}`);
  const actual = params.run(fixture.input);
  const actualJson = stableStringify(actual);
  const expectedJson = stableStringify(fixture.expected);
  assert.equal(actualJson, expectedJson, `${params.id} parity mismatch`);
  return actual;
}

/**
 * @param {string} relFixturePath
 * @returns {string}
 */
export function fixturePath(relFixturePath) {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "fixtures", relFixturePath);
}
