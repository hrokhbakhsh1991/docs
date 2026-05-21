import assert from "node:assert/strict";
import test from "node:test";

import { parseDenaliTourCreateForm } from "../denali/validation/denaliWizardFormZod";
import { buildDenaliTourCreateTestValues } from "./denaliTourCreateFormModel";
test("parseDenaliTourCreateForm does not throw when NODE_ENV=test", () => {
  const prev = process.env.NODE_ENV;
  (process.env as any).NODE_ENV = "test";
  try {
    assert.doesNotThrow(() => parseDenaliTourCreateForm(buildDenaliTourCreateTestValues()));
  } finally {
    (process.env as any).NODE_ENV = prev;
  }
});

test("parseDenaliTourCreateForm throws in development", () => {
  const prev = process.env.NODE_ENV;
  (process.env as any).NODE_ENV = "development";
  try {
    assert.throws(
      () => parseDenaliTourCreateForm(buildDenaliTourCreateTestValues()),
      /Legacy base schema used in forbidden context/,
    );
  } finally {
    (process.env as any).NODE_ENV = prev;
  }
});
