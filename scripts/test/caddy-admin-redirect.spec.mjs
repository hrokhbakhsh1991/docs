import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("production admin root redirects preserve the requested HTTPS host", () => {
  const caddy = readFileSync(new URL("../../deploy/vps/caddy/Caddyfile", import.meta.url), "utf8");
  for (const host of [
    "http://*.admin.{$PLATFORM_ROOT_DOMAIN}",
    "http://admin.{$CANONICAL_TENANT_LABEL}.{$PLATFORM_ROOT_DOMAIN}",
  ]) {
    const start = caddy.indexOf(`${host} {`);
    const end = caddy.indexOf("\n}\n", start);
    assert.ok(start >= 0 && end > start, `missing Caddy site: ${host}`);
    const site = caddy.slice(start, end);
    assert.match(site, /@adminRoot path \/\s/);
    assert.match(site, /redir @adminRoot https:\/\/\{host\}\/dashboard 307/);
    assert.match(site, /reverse_proxy 127\.0\.0\.1:\{\$PROD_WEB_PORT\}/);
  }
});
