import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  isSafePortalReturnPath,
  readPortalReturnFromLocation,
  resolveMemberLoginEgressPath,
} from "../src/read-portal-return";

describe("read-portal-return — PCMS login egress", () => {
  it("PCMS-LG-01 accepts safe relative portalReturn paths", () => {
    assert.equal(isSafePortalReturnPath("/me/profile"), true);
    assert.equal(isSafePortalReturnPath("/me/registrations"), true);
    assert.equal(isSafePortalReturnPath("/catalog/tour-1/register"), true);
    assert.equal(isSafePortalReturnPath("//evil.example"), false);
    assert.equal(isSafePortalReturnPath("https://evil.example"), false);
    assert.equal(isSafePortalReturnPath(undefined), false);
  });

  it("PCMS-LG-02 readPortalReturnFromLocation returns null without window", () => {
    assert.equal(readPortalReturnFromLocation(), null);
  });

  it("PCMS-LG-03 isMemberLoginEgressFromLocation treats /login as login egress", () => {
    const source = readFileSync(
      new URL("../src/read-portal-return.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /pathname === "\/login"/);
  });

  it("PCMS-LG-04 resolveMemberLoginEgressPath falls back to default member module", () => {
    assert.equal(resolveMemberLoginEgressPath(), "/me/registrations");
    assert.equal(resolveMemberLoginEgressPath("/me/profile"), "/me/profile");
  });

  it("PCMS-LG-05 completeMemberLoginEgress uses document fallback before default", () => {
    const source = readFileSync(
      new URL("../src/read-portal-return.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /completeMemberLoginEgress/);
    assert.match(source, /readPortalReturnFromDocument/);
    assert.match(source, /DEFAULT_MEMBER_LOGIN_EGRESS_PATH/);
  });

  it("PCMS-LG-06 completeMemberLoginEgressAfterSession waits for session probe", () => {
    const egressSource = readFileSync(
      new URL("../src/read-portal-return.ts", import.meta.url),
      "utf8"
    );
    const waitSource = readFileSync(
      new URL("../src/wait-member-session-cookie.ts", import.meta.url),
      "utf8"
    );
    assert.match(egressSource, /waitForMemberSessionCookie/);
    assert.match(egressSource, /completeMemberLoginEgressAfterSession/);
    assert.match(waitSource, /credentials: "include"/);
    assert.match(waitSource, /AbortSignal\.timeout/);
  });
});
