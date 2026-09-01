/**
 * B2.2 — marketing bare-IP egress contract (red until layout/nav pass bootstrap.pluginId).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  resolvePortalMemberLoginUrl,
  resolvePortalPublicBaseUrl,
} from "@app-tour/guest-surface-host";

import { resolveMarketingShellNavLinks } from "../src/shell/resolve-marketing-shell-nav.server";

const marketingRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

type ResolvePortalMemberLoginUrlB2 = (
  host: string,
  returnPath?: string,
  pluginId?: string
) => string | null;

const resolveLoginWithPluginId = resolvePortalMemberLoginUrl as ResolvePortalMemberLoginUrlB2;

const BARE_IP_HOST = "203.0.113.1:3002";
const DENALI_PLUGIN_ID = "denali";
const DENALI_MY_TRIPS_PATH = "/me/registrations";

describe("marketing bare-ip egress — B2.2", () => {
  it("B2.2-MKT-05a layout wires bootstrap pluginId into portal login URL resolver", () => {
    const layout = readFileSync(join(marketingRoot, "app/layout.tsx"), "utf8");
    assert.match(
      layout,
      /resolvePortalMemberLoginUrl\(\s*host\s*,\s*undefined\s*,\s*bootstrap\.pluginId\s*\)/
    );
  });

  it("B2.2-MKT-05b bare-IP denali bootstrap yields non-null login URL for header sign-in anchor", () => {
    const portalMemberLoginUrl = resolveLoginWithPluginId(
      BARE_IP_HOST,
      undefined,
      DENALI_PLUGIN_ID
    );
    assert.notEqual(portalMemberLoginUrl, null);

    const shell = readFileSync(join(marketingRoot, "src/shell/marketing-shell.tsx"), "utf8");
    assert.match(shell, /portalMemberLoginUrl !== null/);
    assert.match(shell, /data-marketing-header-sign-in/);
    assert.match(shell, /href=\{portalMemberLoginUrl\}/);
  });

  it("B2.2-MKT-06a nav resolver passes bootstrap pluginId into member-module URL builder", () => {
    const nav = readFileSync(
      join(marketingRoot, "src/shell/resolve-marketing-shell-nav.server.ts"),
      "utf8"
    );
    assert.match(
      nav,
      /resolvePortalMemberModuleUrl\(\s*host\s*,\s*link\.memberModuleId\s*,\s*pluginId\s*\)/
    );
  });

  it("B2.2-MKT-06b my-trips nav resolves non-root portal URL when bootstrap pluginId is denali", () => {
    const expectedMyTrips = `${resolvePortalPublicBaseUrl(BARE_IP_HOST)}${DENALI_MY_TRIPS_PATH}`;
    const links = resolveMarketingShellNavLinks(BARE_IP_HOST, DENALI_PLUGIN_ID, "fa");
    const myTrips = links.find((link) => link.id === "my-trips");
    assert.ok(myTrips, "denali guestCrossSurfaceNav must include my-trips");
    assert.notEqual(myTrips.href, "/");
    assert.equal(myTrips.href, expectedMyTrips);
  });
});
