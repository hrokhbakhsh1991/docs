/**
 * B2.4 — bare-IP marketing egress SSR integration (layout wiring + rendered anchors).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

import {
  resolvePortalMemberLoginUrl,
  resolvePortalPublicBaseUrl,
} from "@app-tour/guest-surface-host";

import { resolveMarketingShellNavLinks } from "../src/shell/resolve-marketing-shell-nav.server";

const marketingRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const BARE_IP_HOST = "203.0.113.1:3002";
const DENALI_PLUGIN_ID = "denali";
const DENALI_MY_TRIPS_PATH = "/me/registrations";

function renderSignInAnchor(loginUrl: string | null): string {
  if (loginUrl === null) {
    return "";
  }
  return renderToStaticMarkup(
    createElement(
      "a",
      {
        href: loginUrl,
        "data-marketing-portal-member": true,
        "data-marketing-header-sign-in": true,
      },
      "Sign in"
    )
  );
}

describe("marketing bare-ip SSR integration — B2.4", () => {
  it("B2.4-01 bare-IP denali bootstrap renders header sign-in with portal login + safe portalReturn", () => {
    const portalMemberLoginUrl = resolvePortalMemberLoginUrl(
      BARE_IP_HOST,
      undefined,
      DENALI_PLUGIN_ID
    );
    assert.notEqual(portalMemberLoginUrl, null);

    const html = renderSignInAnchor(portalMemberLoginUrl);
    assert.match(html, /data-marketing-header-sign-in/);
    assert.match(html, /href="[^"]+\/login\?portalReturn=%2Fme%2Fregistrations"/);

    const layout = readFileSync(join(marketingRoot, "app/layout.tsx"), "utf8");
    assert.match(layout, /portalMemberLoginUrl=\{portalMemberLoginUrl\}/);
  });

  it("B2.4-02 my-trips nav href is manifest-backed portal module path, not root", () => {
    const expected = `${resolvePortalPublicBaseUrl(BARE_IP_HOST)}${DENALI_MY_TRIPS_PATH}`;
    const links = resolveMarketingShellNavLinks(BARE_IP_HOST, DENALI_PLUGIN_ID, "fa");
    const myTrips = links.find((link) => link.id === "my-trips");
    assert.ok(myTrips);
    assert.notEqual(myTrips.href, "/");
    assert.equal(myTrips.href, expected);
    assert.match(myTrips.href, /\/me\/registrations$/);
  });

  it("B2.4-03 canonical denali.club works without pluginId override", () => {
    assert.equal(
      resolvePortalMemberLoginUrl("denali.club"),
      "http://portal.denali.club:3003/login?portalReturn=%2Fme%2Fregistrations"
    );
    const links = resolveMarketingShellNavLinks("denali.club", DENALI_PLUGIN_ID, "fa");
    const myTrips = links.find((link) => link.id === "my-trips");
    assert.equal(myTrips?.href, "http://portal.denali.club:3003/me/registrations");
  });

  it("B2.4-04 invalid/no pluginId override cannot emit denali portal URLs on bare IP", () => {
    assert.equal(resolvePortalMemberLoginUrl(BARE_IP_HOST), null);
    assert.equal(resolvePortalMemberLoginUrl(BARE_IP_HOST, undefined, "starter"), null);
    assert.equal(resolvePortalMemberLoginUrl(BARE_IP_HOST, undefined, "not-a-workspace"), null);
    assert.equal(renderSignInAnchor(null), "");
  });

  it("B2.4-05 layout withholds sign-in anchor until member portal plugin is known", () => {
    const shell = readFileSync(join(marketingRoot, "src/shell/marketing-shell.tsx"), "utf8");
    assert.match(shell, /portalMemberLoginUrl !== null \?/);
    assert.match(shell, /data-marketing-header-sign-in/);
    assert.doesNotMatch(shell, /data-marketing-header-sign-in[\s\S]*portalMemberLoginUrl === null/);
  });
});
