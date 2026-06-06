import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "start-outbox-relay.ts"),
  "utf8"
);

describe("start outbox relay (DEC-076 / SD-G2)", () => {
  it("stop returns Promise and awaits in-flight tick", () => {
    assert.match(source, /stop:\s*async\s*\(\)/);
    assert.match(source, /inFlightTick/);
    assert.match(source, /await inFlightTick/);
  });

  it("OutboxRelayHandle.stop is async in type export", () => {
    assert.match(source, /stop:\s*\(\)\s*=>\s*Promise<void>/);
  });

  it("uses exponential backoff scheduler instead of fixed setInterval (DEC-111)", () => {
    assert.match(source, /computeRelayBackoff/);
    assert.match(source, /setTimeout/);
    assert.doesNotMatch(source, /setInterval\(tick/);
  });
});
