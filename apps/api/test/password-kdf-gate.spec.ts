import assert from "node:assert/strict";
import { test } from "node:test";
import { PasswordKdfBusyError, PasswordKdfGate } from "../src/identity/password-kdf-gate";

test("password work has a bounded concurrency and waiting queue", async () => {
  const gate = new PasswordKdfGate(1, 1);
  let release: (() => void) | undefined;
  let waitingStarted = false;
  const first = gate.run(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      })
  );
  const second = gate.run(async () => {
    waitingStarted = true;
  });
  await assert.rejects(
    gate.run(async () => {}),
    PasswordKdfBusyError
  );
  assert.equal(waitingStarted, false);
  release!();
  await Promise.all([first, second]);
  assert.equal(waitingStarted, true);
  await gate.run(async () => {});
  await assert.rejects(
    gate.run(async () => {
      throw new Error("failed work");
    }),
    /failed work/
  );
  await gate.run(async () => {});
});
