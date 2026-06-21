/**
 * P4-A — marketing on-demand revalidate route
 * @see docs/phase-17/platform-club-catalog-publish.mdoc
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { POST } from "../app/api/revalidate/route";

const TENANT_ID = "00000000-0000-4000-8000-000000000088";

function snapshotSecret(): string | undefined {
  return process.env.MARKETING_REVALIDATE_SECRET;
}

function setSecret(value: string | undefined): void {
  if (value === undefined) {
    delete process.env.MARKETING_REVALIDATE_SECRET;
  } else {
    process.env.MARKETING_REVALIDATE_SECRET = value;
  }
}

describe("POST /api/revalidate (P4-A RR)", () => {
  afterEach(() => {
    setSecret(undefined);
  });

  it("RR-01 returns 503 when MARKETING_REVALIDATE_SECRET unset", async () => {
    setSecret(undefined);
    const response = await POST(
      new Request("http://localhost/api/revalidate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId: TENANT_ID }),
      })
    );
    assert.equal(response.status, 503);
    const body = (await response.json()) as { error: string };
    assert.equal(body.error, "MARKETING_REVALIDATE_NOT_CONFIGURED");
  });

  it("RR-02 returns 401 when secret header wrong", async () => {
    setSecret("expected-secret");
    const response = await POST(
      new Request("http://localhost/api/revalidate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-marketing-revalidate-secret": "wrong",
        },
        body: JSON.stringify({ tenantId: TENANT_ID }),
      })
    );
    assert.equal(response.status, 401);
  });

  it("RR-03 returns 400 when tenantId missing", async () => {
    setSecret("expected-secret");
    const response = await POST(
      new Request("http://localhost/api/revalidate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-marketing-revalidate-secret": "expected-secret",
        },
        body: JSON.stringify({}),
      })
    );
    assert.equal(response.status, 400);
    const body = (await response.json()) as { error: string };
    assert.equal(body.error, "TENANT_ID_REQUIRED");
  });

  it("RR-04 authorized request reaches revalidateTag with tenant tag", async () => {
    setSecret("expected-secret");
    let caught: unknown;
    try {
      await POST(
        new Request("http://localhost/api/revalidate", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-marketing-revalidate-secret": "expected-secret",
          },
          body: JSON.stringify({ tenantId: TENANT_ID }),
        })
      );
      assert.fail("expected revalidateTag to require Next runtime");
    } catch (error) {
      caught = error;
    }
    assert.match(String(caught), /marketing-catalog-/);
    assert.match(String(caught), new RegExp(TENANT_ID));
  });
});
