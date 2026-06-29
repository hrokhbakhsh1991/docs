import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseWorkspaceExposureCatalogResponse } from "../src/exposure/exposure-catalog-client";

describe("exposure catalog client", () => {
  it("parses native exposure catalog responses", () => {
    const parsed = parseWorkspaceExposureCatalogResponse({
      workspaceType: "denali",
      source: "registry_deliverable_migration_seed",
      fields: [
        {
          id: "title",
          canonicalPath: "title",
          kind: "text",
          tags: ["deliverable"],
          adminLabel: "Tour Title",
        },
      ],
    });

    assert.equal(parsed.workspaceType, "denali");
    assert.equal(parsed.source, "registry_deliverable_migration_seed");
    assert.deepEqual(parsed.fields, [
      {
        id: "title",
        canonicalPath: "title",
        kind: "text",
        tags: ["deliverable"],
        adminLabel: "Tour Title",
      },
    ]);
  });
});
