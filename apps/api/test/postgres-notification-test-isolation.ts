/**
 * Shared outbox relay isolation for MNI postgres integration specs.
 * Mirrors bootstrap-outbox-test-env hooks when specs run without that import.
 */
import { beforeEach } from "node:test";

import { resetOutboxRelayTenantBudgetForTests } from "../src/outbox/outbox-relay-tenant-budget";
import { quiesceStaleOutboxProcessing } from "./test-helpers";

export function installPostgresNotificationTestIsolation(): void {
  beforeEach(async () => {
    resetOutboxRelayTenantBudgetForTests();
    await quiesceStaleOutboxProcessing(0);
  });
}
