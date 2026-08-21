import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, describe, it } from "node:test";

import { fireEvent, render, waitFor } from "@testing-library/react";
import React from "react";

import { POST } from "../app/api/platform/auth/logout/route";
import { PlatformShell } from "../src/platform/platform-shell";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("platform logout BFF", () => {
  it("clears only platform_session without returning a token", async () => {
    const response = await POST();
    const body = await response.json();
    const setCookie = response.headers.get("Set-Cookie") ?? "";

    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true });
    assert.doesNotMatch(JSON.stringify(body), /token|jwt|session/i);
    assert.match(
      setCookie,
      /^platform_session=; Path=\/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT$/
    );
    assert.doesNotMatch(setCookie, /(?:^|; )session=/);
  });

  it("permits the non-privileged logout route through platform middleware", () => {
    const source = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
    assert.match(source, /pathname === "\/api\/platform\/auth\/logout"/);
  });
});

describe("platform shell logout", () => {
  it("posts to the platform logout route when sign out is clicked", async () => {
    const requests: Array<{ input: unknown; init: RequestInit | undefined }> = [];
    globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
      requests.push({ input, init });
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    const { getByRole } = render(
      <PlatformShell session={{ phone: "+989121234567", role: "owner" }} navItems={[]}>
        <div>Platform content</div>
      </PlatformShell>
    );

    fireEvent.click(getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      assert.deepEqual(requests, [
        {
          input: "/api/platform/auth/logout",
          init: { method: "POST", credentials: "same-origin" },
        },
      ]);
    });
  });
});
