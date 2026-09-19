import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const here = import.meta.dirname;

describe("outbox relay worker bootstrap", () => {
  it("starts the integration delivery worker in the split relay runtime", () => {
    const source = readFileSync(join(here, "bootstrap-outbox-relay-worker.ts"), "utf8");

    assert.match(source, /bootstrapIntegrationProviders\(\);/);
    assert.match(source, /startIntegrationDeliveryWorkerIfEnabled\(\);/);
    assert.match(source, /onShutdown: \(\) => integrationDelivery\.stop\(\)/);
  });

  it("enables integration dispatch and delivery in the relay deployment manifest", () => {
    const manifest = readFileSync(
      join(here, "../../../..", "deploy", "argo-rollouts", "outbox-relay-deployment.yaml"),
      "utf8"
    );

    assert.match(manifest, /name: INTEGRATION_DELIVERY_ENABLED\s+value: "true"/);
    assert.match(manifest, /name: INTEGRATION_DELIVERY_WORKER_ENABLED\s+value: "true"/);
  });
});
