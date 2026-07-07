import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(process.cwd(), "..", "..");
const PLAN = join(REPO_ROOT, "docs/dev/tour-published-telegram-rollout-plan.mdoc");
const RUNBOOK = join(REPO_ROOT, "docs/dev/runbooks/tour-published-telegram-delivery.mdoc");
const CATALOG = join(
  REPO_ROOT,
  "apps/api/src/integrations/platform/resolve-effective-integration-event-catalog.ts",
);
const WEB_EVENT_LIST = join(REPO_ROOT, "apps/web/src/exposure/build-exposure-event-type-list.ts");

describe("tour published rollout closure contract", () => {
  it("documents INT-002 rollout plan and operator runbook", () => {
    assert.match(readFileSync(PLAN, "utf8"), /INT-002a/);
    assert.match(readFileSync(PLAN, "utf8"), /resolveEffectiveIntegrationEventCatalog/);
    assert.match(readFileSync(RUNBOOK, "utf8"), /TourPublished/);
  });

  it("wires effective integration event catalog module", () => {
    assert.match(readFileSync(CATALOG, "utf8"), /resolveEffectiveIntegrationEventCatalog/);
    assert.match(readFileSync(CATALOG, "utf8"), /mapEffectiveCatalogToPublicEventPolicies/);
  });

  it("wires policy backfill migration for denali telegram", () => {
    const migration = join(
      REPO_ROOT,
      "apps/api/prisma/migrations/20260704100000_backfill_tour_published_event_policies/migration.sql",
    );
    const sql = readFileSync(migration, "utf8");
    assert.match(sql, /TourPublished/);
    assert.match(sql, /workspace_type = 'denali'/);
  });

  it("wires exposure intent remap CLI for TourPublished", () => {
    const plan = join(
      REPO_ROOT,
      "apps/api/src/integrations/migration/tour-published-exposure-remap-plan.ts",
    );
    const runner = join(
      REPO_ROOT,
      "apps/api/src/integrations/migration/run-tour-published-exposure-remap.ts",
    );
    assert.match(readFileSync(plan, "utf8"), /planTourPublishedExposureRemapBatch/);
    assert.match(readFileSync(runner, "utf8"), /runTourPublishedExposureRemapCli/);
  });

  it("includes TourPublished integration spec", () => {
    const spec = join(REPO_ROOT, "apps/api/test/4-integration/tour-published-outbox.spec.ts");
    assert.match(readFileSync(spec, "utf8"), /TourPublished outbox and dispatch/);
    assert.match(
      readFileSync(spec, "utf8"),
      /second,\s*0,\s*"replay of the same domainEventId must not enqueue again"/,
    );
  });

  it("wires create-with-publish TourPublished outbox enqueue", () => {
    const persist = join(REPO_ROOT, "apps/api/src/canonical/atomic-canonical-tour-persist.ts");
    const source = readFileSync(persist, "utf8");
    assert.match(source, /await enqueueTourPublishedOutboxIfPublic\(tx,/);
    assert.match(source, /eventType: "TourCreated"/);
    assert.match(source, /eventType: "TourPublished"/);
  });

  it("web exposure event list no longer hardcodes TourCreated fallback", () => {
    const source = readFileSync(WEB_EVENT_LIST, "utf8");
    assert.doesNotMatch(source, /seen\.add\("TourCreated"\)/);
    assert.match(source, /TourPublished/);
    assert.match(source, /deprecatedEventTypes/);
    assert.match(source, /addRoutableEventType/);
  });
});
