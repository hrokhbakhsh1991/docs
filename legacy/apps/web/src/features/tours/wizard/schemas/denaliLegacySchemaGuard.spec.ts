import assert from "node:assert/strict";
import test from "node:test";

import {
  assertDenaliLegacySchemaAllowed,
  DenaliLegacySchemaForbiddenError,
  parseDenaliTourCreateForm,
} from "@repo/denali-domain";

import { buildDenaliTourCreateTestValues } from "./denaliTourCreateFormModel";

test("assertDenaliLegacySchemaAllowed throws in all environments for forbidden sites", () => {
  assert.throws(
    () => assertDenaliLegacySchemaAllowed("submit"),
    (error: unknown) => error instanceof DenaliLegacySchemaForbiddenError,
  );
});

test("parseDenaliTourCreateForm throws when legacy parse is invoked", () => {
  assert.throws(
    () => parseDenaliTourCreateForm(buildDenaliTourCreateTestValues()),
    (error: unknown) => error instanceof DenaliLegacySchemaForbiddenError,
  );
});
