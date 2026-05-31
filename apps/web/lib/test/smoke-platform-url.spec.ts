import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_TEST_PLATFORM_BASE_URL,
  resolveTestPlatformBaseUrl,
  resolveTestPlatformHostLabel,
} from "./smoke-platform-url";

test("resolveTestPlatformBaseUrl defaults to workspace-test host", () => {
  const prevPlatform = process.env.TEST_PLATFORM_BASE_URL;
  const prevPw = process.env.PW_BASE_URL;
  delete process.env.TEST_PLATFORM_BASE_URL;
  delete process.env.PW_BASE_URL;
  try {
    assert.equal(resolveTestPlatformBaseUrl(), DEFAULT_TEST_PLATFORM_BASE_URL);
    assert.equal(resolveTestPlatformHostLabel(), "workspace-test");
  } finally {
    if (prevPlatform === undefined) {
      delete process.env.TEST_PLATFORM_BASE_URL;
    } else {
      process.env.TEST_PLATFORM_BASE_URL = prevPlatform;
    }
    if (prevPw === undefined) {
      delete process.env.PW_BASE_URL;
    } else {
      process.env.PW_BASE_URL = prevPw;
    }
  }
});

test("resolveTestPlatformBaseUrl prefers TEST_PLATFORM_BASE_URL", () => {
  const prevPlatform = process.env.TEST_PLATFORM_BASE_URL;
  process.env.TEST_PLATFORM_BASE_URL = "http://custom-workspace.localhost:3000/";
  try {
    assert.equal(resolveTestPlatformBaseUrl(), "http://custom-workspace.localhost:3000");
    assert.equal(resolveTestPlatformHostLabel(), "custom-workspace");
  } finally {
    if (prevPlatform === undefined) {
      delete process.env.TEST_PLATFORM_BASE_URL;
    } else {
      process.env.TEST_PLATFORM_BASE_URL = prevPlatform;
    }
  }
});
