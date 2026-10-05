import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const panelSource = readFileSync(
  new URL(
    "../app/(app)/settings/integrations/integration-event-delivery-policy-panel.tsx",
    import.meta.url
  ),
  "utf8"
);

describe("BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE host warm-up", () => {
  it("fails closed instead of rendering raw registry fields before adapter readiness", () => {
    assert.match(panelSource, /hostAdaptersStatus/);
    assert.match(panelSource, /setHostAdaptersStatus\("failed"\)/);
    assert.match(
      panelSource,
      /if \(hostAdaptersStatus !== "ready" \|\| hostAdaptersReadyPluginId !== pluginId\) \{\s*return \[\];/s
    );
    assert.doesNotMatch(
      panelSource,
      /if \(!hostAdaptersWarm\) \{\s*return exposureCandidateFields;/s
    );
  });
});
