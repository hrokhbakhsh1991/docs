import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { listPlatformNavItems } from "../src/platform/platform-nav";

describe("platform-nav", () => {
  it("7 items", () => {
    assert.equal(listPlatformNavItems().length, 7);
  });

  it("workspaces href /platform/workspace-definitions", () => {
    const workspaces = listPlatformNavItems().find((item) => item.id === "definitions");
    assert.equal(workspaces?.href, "/platform/workspace-definitions");
  });

  it("team href /platform/team", () => {
    const team = listPlatformNavItems().find((item) => item.id === "team");
    assert.equal(team?.href, "/platform/team");
  });

  it("audit href /platform/audit", () => {
    const audit = listPlatformNavItems().find((item) => item.id === "audit");
    assert.equal(audit?.href, "/platform/audit");
  });

  it("clubs href", () => {
    const clubs = listPlatformNavItems().find((item) => item.id === "clubs");
    assert.equal(clubs?.href, "/platform/clubs");
  });

  it("all hrefs /platform*", () => {
    for (const item of listPlatformNavItems()) {
      assert.match(item.href, /^\/platform/);
    }
  });
});
