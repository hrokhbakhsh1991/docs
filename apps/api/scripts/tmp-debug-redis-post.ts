import http from "node:http";
import { randomUUID } from "node:crypto";
import { createRequestListener } from "../src/app";
import { createTestToursService } from "../test/test-helpers";
import { resetTenantRateLimiterStoreForTests } from "../src/middleware/tenant-rate-limiter";

function makeTenantId() {
  for (let i = 0; i < 32; i += 1) {
    const id = randomUUID();
    if (/^[a-f]/i.test(id)) return id;
  }
  throw new Error("no tenant id");
}

resetTenantRateLimiterStoreForTests();
const tid = makeTenantId();
const listener = createRequestListener({ toursService: createTestToursService() });
const body = JSON.stringify({
  schemaVersion: 1,
  roots: ["basics", "details"],
  data: { basics: { title: "x" }, details: { summary: "ok" } },
});

const server = http.createServer(listener);
server.listen(0, async () => {
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("bad addr");
  const res = await fetch(`http://127.0.0.1:${addr.port}/tours`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant-id": tid,
      "x-authenticated-tenant-id": tid,
      "x-user-id": "u",
      "x-actor-role": "admin",
      "x-membership-status": "ACTIVE",
      "x-workspace-id": "ws-1",
    },
    body,
  });
  console.log("tenant", tid);
  console.log("status", res.status);
  console.log("body", await res.text());
  server.close();
});
