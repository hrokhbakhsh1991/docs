import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

const catalogRoot = join(__dirname, "../src/catalog");

describe("BUG-STG-008/013 PDP policy and start-time contract", () => {
  it("renders start time from departureAt and mounts policy preview data", () => {
    const logistics = readFileSync(join(catalogRoot, "catalog-tour-detail-logistics.tsx"), "utf8");
    const preview = readFileSync(
      join(catalogRoot, "catalog-tour-detail-register-preview.tsx"),
      "utf8"
    );

    assert.match(logistics, /const startTime = tour\.departureAt/);
    assert.match(logistics, /detail\.logistics\.startTime/);
    assert.match(preview, /paymentCollection: \(\) =>/);
    assert.match(preview, /registrationApproval: \(mode\) =>/);
  });
});

describe("BUG-STG-025 free collection labels", () => {
  it("renders the free label on PLP and PDP only for paymentCollection=free", () => {
    const card = readFileSync(join(catalogRoot, "catalog-tour-card.tsx"), "utf8");
    const rail = readFileSync(join(catalogRoot, "catalog-tour-detail-booking-rail.tsx"), "utf8");

    assert.match(card, /const freeCollection = tour\.paymentCollection === "free"/);
    assert.match(card, /freeCollection \? \(/);
    assert.match(card, /data-marketing-catalog-card-free/);
    assert.match(card, /resolveCatalogFreeCollectionLabel/);
    assert.match(rail, /tour\.paymentCollection === "free" \? \(/);
    assert.match(rail, /data-marketing-catalog-detail-free/);
    assert.match(rail, /resolveCatalogFreeCollectionLabel/);
  });
});
