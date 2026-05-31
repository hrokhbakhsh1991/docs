import assert from "node:assert/strict";
import test from "node:test";

import { resolvePartitionedPublicRateLimitBucket } from "../../../src/common/tenant/tenant-runtime-policy";

const TOUR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REGISTRATION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test("resolvePartitionedPublicRateLimitBucket shards public tour catalog probes by tour id", () => {
  const bucket = resolvePartitionedPublicRateLimitBucket({
    path: `/api/v2/tours/${TOUR_ID}/register`,
    url: `/api/v2/tours/${TOUR_ID}/register`,
    headers: { host: "ignored.example.com" },
    hostname: "ignored.example.com",
  });
  assert.equal(bucket, `catalog:tour:${TOUR_ID}`);
});

test("resolvePartitionedPublicRateLimitBucket shards registration probes by registration id", () => {
  const bucket = resolvePartitionedPublicRateLimitBucket({
    path: `/api/v2/registrations/${REGISTRATION_ID}`,
    url: `/api/v2/registrations/${REGISTRATION_ID}`,
    headers: {},
    hostname: "fallback.example.com",
  });
  assert.equal(bucket, `catalog:registration:${REGISTRATION_ID}`);
});

test("resolvePartitionedPublicRateLimitBucket falls back to host signature", () => {
  const bucket = resolvePartitionedPublicRateLimitBucket({
    path: "/api/v2/tours",
    url: "/api/v2/tours",
    headers: { host: "acme.example.com:443" },
    hostname: "internal-lb.local",
  });
  assert.equal(bucket, "host:acme.example.com");
});
