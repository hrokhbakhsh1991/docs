import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ImpersonationReadOnlyError,
  IMPERSONATION_READ_ONLY,
} from "../src/identity/impersonation-read-only.error.ts";

describe("ImpersonationReadOnlyError", () => {
  it("code constant", () => {
    assert.equal(new ImpersonationReadOnlyError().code, IMPERSONATION_READ_ONLY);
  });

  it("name", () => {
    assert.equal(new ImpersonationReadOnlyError().name, "ImpersonationReadOnlyError");
  });
});
