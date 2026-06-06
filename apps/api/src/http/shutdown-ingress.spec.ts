import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, afterEach } from "node:test";

import {
  isGracefulShutdownInProgress,
  resetGracefulShutdownStateForTests,
  runGracefulShutdown,
} from "../server/graceful-shutdown";
import { rejectRequestDuringShutdown } from "./shutdown-ingress";

const appPath = join(dirname(fileURLToPath(import.meta.url)), "../app.ts");

describe("shutdown ingress reject (DEC-101)", () => {
  afterEach(() => {
    resetGracefulShutdownStateForTests();
  });

  it("app.ts wires rejectRequestDuringShutdown before dispatch", () => {
    const source = readFileSync(appPath, "utf8");
    assert.match(source, /rejectRequestDuringShutdown/);
    assert.match(source, /dispatchRequest/);
    const rejectIdx = source.indexOf("rejectRequestDuringShutdown");
    const dispatchIdx = source.indexOf("dispatchRequest");
    assert.ok(rejectIdx >= 0 && dispatchIdx >= 0 && rejectIdx < dispatchIdx);
  });

  it("returns false when not shutting down", () => {
    assert.equal(isGracefulShutdownInProgress(), false);
    const chunks: string[] = [];
    const res = {
      writableEnded: false,
      setHeader() {},
      writeHead() {},
      end(chunk: string) {
        chunks.push(chunk);
      },
    } as unknown as import("node:http").ServerResponse;
    assert.equal(
      rejectRequestDuringShutdown({} as import("node:http").IncomingMessage, res),
      false
    );
  });
});
