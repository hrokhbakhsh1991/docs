import assert from "node:assert/strict";
import test from "node:test";

import {
  assertSafeOutboundUrl,
  isRestrictedIpv4,
  isRestrictedIpv6,
} from "./assert-safe-outbound-url";
import { EgressUrlForbiddenError } from "./egress-url-forbidden.error";
import { ForbiddenException } from "./forbidden.exception";

async function assertBlocked(url: string): Promise<void> {
  let caught: unknown;
  try {
    await assertSafeOutboundUrl(url);
  } catch (error) {
    caught = error;
  }
  assert.ok(
    caught instanceof EgressUrlForbiddenError,
    `Expected egress block for ${url}, got ${String(caught)}`,
  );
}

async function assertControlCharBlocked(url: string): Promise<void> {
  let caught: unknown;
  try {
    await assertSafeOutboundUrl(url);
  } catch (error) {
    caught = error;
  }
  assert.ok(
    caught instanceof ForbiddenException,
    `Expected ForbiddenException for ${url}, got ${String(caught)}`,
  );
  assert.equal((caught as ForbiddenException).message, "EGRESS_URL_CONTROL_CHARS_FORBIDDEN");
}

test("assertSafeOutboundUrl blocks RFC1918 IPv4 literals", async () => {
  await assertBlocked("http://10.0.0.1/hook");
  await assertBlocked("http://172.16.0.1/hook");
  await assertBlocked("http://192.168.1.1/hook");
});

test("assertSafeOutboundUrl blocks loopback and metadata IPs", async () => {
  await assertBlocked("http://127.0.0.1/hook");
  await assertBlocked("http://169.254.169.254/latest/meta-data");
  await assertBlocked("http://[::1]/hook");
});

test("assertSafeOutboundUrl blocks localhost hostnames", async () => {
  await assertBlocked("http://localhost/hook");
  await assertBlocked("https://metadata.google.internal/computeMetadata/v1/");
});

test("assertSafeOutboundUrl rejects non-http(s) schemes", async () => {
  await assertBlocked("file:///etc/passwd");
  await assertBlocked("ftp://example.com/hook");
});

test("assertSafeOutboundUrl allows public HTTPS URLs and returns pinned agent", async () => {
  const pinned = await assertSafeOutboundUrl("https://example.com/webhook");
  assert.equal(pinned.hostname, "example.com");
  assert.equal(pinned.protocol, "https:");
  assert.equal(pinned.port, 443);
  assert.ok(pinned.agent);
});

test("assertSafeOutboundUrl blocks percent-encoded CRLF in pathname", async () => {
  await assertControlCharBlocked("https://example.com/webhook%0d%0aX-Evil:%20smuggle");
});

test("assertSafeOutboundUrl blocks percent-encoded CRLF in search", async () => {
  await assertControlCharBlocked("https://example.com/webhook?next=%0d%0aSet-Cookie:%20evil");
});

test("assertSafeOutboundUrl blocks percent-encoded control characters in hash", async () => {
  await assertControlCharBlocked("https://example.com/webhook#frag%07");
});

test("assertSafeOutboundUrl blocks percent-encoded ASCII control bytes", async () => {
  await assertControlCharBlocked("https://example.com/webhook%07");
});

test("assertSafeOutboundUrl blocks raw control characters in raw input before URL parse", async () => {
  await assertControlCharBlocked("https://example.com/webhook%0A");
});

test("isRestrictedIpv6 blocks hex-compressed IPv4-mapped loopback", () => {
  assert.equal(isRestrictedIpv6("::ffff:7f00:1"), true);
  assert.equal(isRestrictedIpv6("::ffff:a9fe:a9fe"), true);
  assert.equal(isRestrictedIpv6("::ffff:127.0.0.1"), true);
});

test("isRestrictedIpv6 allows public IPv4-mapped addresses", () => {
  assert.equal(isRestrictedIpv6("::ffff:5df4:12c"), false);
});

test("isRestrictedIpv4 blocks metadata and RFC1918", () => {
  assert.equal(isRestrictedIpv4("127.0.0.1"), true);
  assert.equal(isRestrictedIpv4("10.0.0.1"), true);
  assert.equal(isRestrictedIpv4("8.8.8.8"), false);
});
