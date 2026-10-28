import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { NextRequest } from "next/server";

import { middleware } from "../middleware";

const env = process.env as Record<string, string | undefined>;
const envSnapshot = {
  NODE_ENV: env.NODE_ENV,
  PLATFORM_ROOT_DOMAIN: env.PLATFORM_ROOT_DOMAIN,
  ALLOW_DEV_WEB_SESSION: env.ALLOW_DEV_WEB_SESSION,
};

afterEach(() => {
  for (const [key, value] of Object.entries(envSnapshot)) {
    if (value !== undefined) {
      env[key] = value;
    } else {
      delete env[key];
    }
  }
});

describe("admin ingress redirects", () => {
  it("keeps the public host and protocol when the request URL is an upstream URL", async () => {
    env.NODE_ENV = "production";
    env.PLATFORM_ROOT_DOMAIN = "shenski.com";
    delete env.ALLOW_DEV_WEB_SESSION;

    const request = new NextRequest("http://127.0.0.1:23000/", {
      headers: {
        host: "denali.admin.shenski.com",
        "x-forwarded-host": "denali.admin.shenski.com",
        "x-forwarded-proto": "https",
      },
    });

    const response = await middleware(request);

    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "https://denali.admin.shenski.com/dashboard");
  });
});
