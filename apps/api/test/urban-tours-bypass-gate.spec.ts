/**
 * Phase 8.1 — TPG-8.1-01..05 tours publish-field bypass gate
 * Authority: docs/phase-8/appendices/TOURS-PUBLISH-FIELD-GATE.md
 */
import assert from "node:assert/strict";
import http from "node:http";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { encodeDevBearerToken } from "../src/tenant-kernel/parse-bearer";
import { urbanTourPatchTouchesPublishFields } from "@app-tour/workspace-urban/host/http";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

const URBAN_TENANT_ID = "00000000-0000-4000-8000-000000000004";
const URBAN_WORKSPACE_ID = "00000000-0000-4000-8000-000000000403";
const URBAN_OWNER_USER_ID = "00000000-0000-4000-8000-000000000401";
const URBAN_ADMIN_USER_ID = "00000000-0000-4000-8000-000000000405";
const URBAN_MEMBER_USER_ID = "00000000-0000-4000-8000-000000000402";
const URBAN_DRAFT_TOUR_ID = "00000000-0000-4000-8000-000000000411";

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      assert.equal(actual, expected);
    },
  };
}

function bearer(role: "owner" | "admin" | "member"): string {
  const userId =
    role === "owner"
      ? URBAN_OWNER_USER_ID
      : role === "admin"
        ? URBAN_ADMIN_USER_ID
        : URBAN_MEMBER_USER_ID;
  return encodeDevBearerToken({
    userId,
    tenantId: URBAN_TENANT_ID,
    role,
    status: "ACTIVE",
    workspaceId: URBAN_WORKSPACE_ID,
  });
}

async function patchTour(
  listener: ReturnType<typeof createRequestListener>,
  authorization: string,
  body: unknown
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("no listen address"));
        return;
      }
      const payload = JSON.stringify(body);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: `/tours/${URBAN_DRAFT_TOUR_ID}`,
          method: "PATCH",
          headers: {
            Authorization: authorization,
            "Content-Type": "application/json",
            "Content-Length": String(Buffer.byteLength(payload)),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            server.close();
            const raw = Buffer.concat(chunks).toString("utf8");
            resolve({
              status: res.statusCode ?? 0,
              body: raw.length > 0 ? JSON.parse(raw) : null,
            });
          });
        }
      );
      req.on("error", (err) => {
        server.close();
        reject(err);
      });
      req.write(payload);
      req.end();
    });
  });
}

installMemoryStorageDriverForDescribe();

describe("Phase 8.1 — urbanTourPatchTouchesPublishFields detector", () => {
  it("detects tour.status in data as publish field touch", () => {
    const touched = urbanTourPatchTouchesPublishFields({
      rowVersion: 1,
      data: { tour: { status: "published" } },
    });
    expect(touched).toBe(true);
  });

  it("detects publishStatus root key as publish field touch", () => {
    const touched = urbanTourPatchTouchesPublishFields({
      rowVersion: 1,
      data: { publishStatus: "published" },
    });
    expect(touched).toBe(true);
  });

  it("does not flag draft title-only patch", () => {
    const touched = urbanTourPatchTouchesPublishFields({
      rowVersion: 1,
      data: { tour: { title: "x" } },
    });
    expect(touched).toBe(false);
  });
});

describe("Phase 8.1 — TPG HTTP bypass gate on PATCH /tours/{tourId}", () => {
  let listener: ReturnType<typeof createRequestListener>;

  before(() => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_ALLOW_DEV_BEARER = "true";
    process.env.URBAN_TEST_WORKSPACE_TYPE = "urban";
    listener = createRequestListener({ toursService: createTestToursService() });
  });

  const adminPublishBody = {
    rowVersion: 1,
    data: { tour: { status: "published" } },
  };

  const memberPublishBody = {
    rowVersion: 1,
    data: { publishStatus: "published" },
  };

  const draftBodyRv2 = {
    rowVersion: 2,
    data: { tour: { title: "admin-draft" } },
  };

  const draftBodyRv3 = {
    rowVersion: 3,
    data: { tour: { title: "owner-draft" } },
  };

  it("TPG-8.1-01 admin publish-field patch returns 403 code URBAN_OWNER_REQUIRED", async () => {
    const response = await patchTour(listener, bearer("admin"), adminPublishBody);
    expect(response.status).toBe(403);
    expect((response.body as { code?: string }).code).toBe("URBAN_OWNER_REQUIRED");
  });

  it("TPG-8.1-02 member publish-field patch returns 403 code URBAN_OWNER_REQUIRED", async () => {
    const response = await patchTour(listener, bearer("member"), memberPublishBody);
    expect(response.status).toBe(403);
    expect((response.body as { code?: string }).code).toBe("URBAN_OWNER_REQUIRED");
  });

  it("TPG-8.1-03 owner publish-field patch returns 200", async () => {
    const response = await patchTour(listener, bearer("owner"), adminPublishBody);
    expect(response.status).toBe(200);
  });

  it("TPG-8.1-04 admin draft-only patch returns 200", async () => {
    const response = await patchTour(listener, bearer("admin"), draftBodyRv2);
    expect(response.status).toBe(200);
  });

  it("TPG-8.1-05 owner draft-only patch returns 200", async () => {
    const response = await patchTour(listener, bearer("owner"), draftBodyRv3);
    expect(response.status).toBe(200);
  });
});
