import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform-team-page", () => {
  it("phone role fields", () => {
    const pageSource = readFileSync(
      new URL("../app/(platform)/platform/team/page.tsx", import.meta.url),
      "utf8"
    );
    assert.match(pageSource, /item\.phone/);
    assert.match(pageSource, /item\.role/);
    assert.match(pageSource, /TeamInviteForm/);

    const formSource = readFileSync(
      new URL("../src/platform/team/team-invite-form.tsx", import.meta.url),
      "utf8"
    );
    assert.match(formSource, /name="phone"/);
    assert.match(formSource, /name="role"/);
  });
});
