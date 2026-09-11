import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const featureRoot = join(dirname(fileURLToPath(import.meta.url)), "../src/features/tickets");

describe("operator ticket label fallback", () => {
  it("does not expose unknown dynamic ticket label keys", () => {
    const inbox = readFileSync(join(featureRoot, "operator-tickets-inbox-row.tsx"), "utf8");
    const detail = readFileSync(join(featureRoot, "operator-tickets-detail-panel.tsx"), "utf8");
    for (const source of [inbox, detail]) {
      assert.match(source, /t\.has\(key\) \? t\(key\) : fallback/);
      assert.match(source, /resolveTicketLabel\(t/);
    }
  });
});
