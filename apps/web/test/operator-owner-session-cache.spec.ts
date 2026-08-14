import test from "node:test";
import assert from "node:assert/strict";

import { loginOperatorWithPhone, OPERATOR_OWNER_MOBILE } from "./fixtures/operator-owner-session";

type Cookie = {
  readonly name: string;
  readonly value: string;
  readonly domain: string;
  readonly path: string;
  readonly httpOnly: boolean;
  readonly sameSite: string;
};

function createFakeResponse(body: unknown, ok = true, status = 200) {
  return {
    ok() {
      return ok;
    },
    status() {
      return status;
    },
    async text() {
      return JSON.stringify(body);
    },
    url() {
      return "http://probe.admin.localhost:3000/";
    },
  };
}

function createFakePage(baseURL = "http://denali.admin.localhost:3000") {
  const posts: { url: string; data?: unknown }[] = [];
  const gets: string[] = [];
  const cookies: Cookie[] = [];

  return {
    page: {
      request: {
        async post(url: string, options?: { data?: unknown }) {
          posts.push({ url, data: options?.data });
          if (url === "/api/auth/request-otp") {
            return createFakeResponse({ challenge_id: "challenge-1" });
          }
          if (url === "/api/auth/login-web-session") {
            return createFakeResponse({ session_token: "session-token-1" });
          }
          return createFakeResponse({}, false, 404);
        },
        async get(url: string) {
          gets.push(url);
          if (url === "/api/auth/membership-ability-context") {
            return createFakeResponse({ ok: true });
          }
          return createFakeResponse({}, false, 404);
        },
      },
      context() {
        return {
          async addCookies(nextCookies: Cookie[]) {
            cookies.push(...nextCookies);
          },
        };
      },
      url() {
        return baseURL;
      },
      async goto() {
        throw new Error("goto should not be called when skipDashboard=true");
      },
    },
    posts,
    gets,
    cookies,
  };
}

test("operator session fixture reuses cached token for same host and phone", async () => {
  const { page, posts, gets, cookies } = createFakePage();

  await loginOperatorWithPhone(page as never, OPERATOR_OWNER_MOBILE, {
    skipDashboard: true,
  });
  await loginOperatorWithPhone(page as never, OPERATOR_OWNER_MOBILE, {
    skipDashboard: true,
  });

  assert.equal(posts.filter((entry) => entry.url === "/api/auth/request-otp").length, 1);
  assert.equal(posts.filter((entry) => entry.url === "/api/auth/login-web-session").length, 1);
  assert.equal(gets.filter((entry) => entry === "/api/auth/membership-ability-context").length, 2);
  assert.equal(cookies.length, 2);
  assert.ok(cookies.every((cookie) => cookie.value === "session-token-1"));
});

test("operator session fixture does not reuse cached token across hosts", async () => {
  const first = createFakePage("http://denali.admin.localhost:3000");
  const second = createFakePage("http://harbor.admin.localhost:3000");
  const phone = "+15550009991";

  await loginOperatorWithPhone(first.page as never, phone, {
    skipDashboard: true,
  });
  await loginOperatorWithPhone(second.page as never, phone, {
    skipDashboard: true,
  });

  assert.equal(first.posts.filter((entry) => entry.url === "/api/auth/request-otp").length, 1);
  assert.equal(second.posts.filter((entry) => entry.url === "/api/auth/request-otp").length, 1);
});

test("operator session fixture probes request host before the first navigation", async () => {
  const originalPlaywrightBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
  const originalSmokeBaseUrl = process.env.SMOKE_BASE_URL;
  const originalSmokeWebBaseUrl = process.env.SMOKE_WEB_BASE_URL;
  delete process.env.PLAYWRIGHT_BASE_URL;
  delete process.env.SMOKE_BASE_URL;
  delete process.env.SMOKE_WEB_BASE_URL;

  const { page, cookies, gets } = createFakePage("about:blank");

  try {
    await loginOperatorWithPhone(page as never, "+15550009992", {
      skipDashboard: true,
    });
  } finally {
    process.env.PLAYWRIGHT_BASE_URL = originalPlaywrightBaseUrl;
    process.env.SMOKE_BASE_URL = originalSmokeBaseUrl;
    process.env.SMOKE_WEB_BASE_URL = originalSmokeWebBaseUrl;
  }

  assert.equal(cookies[0]?.domain, "probe.admin.localhost");
  assert.equal(gets.includes("/"), true);
});
