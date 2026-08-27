import assert from "node:assert/strict";
import test from "node:test";

import { createClientSafeId, createClientSafeUuid } from "../src/client-safe-id";

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function withCrypto(value: Crypto | undefined, run: () => void): void {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value,
  });
  try {
    run();
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, "crypto", descriptor);
    } else {
      Reflect.deleteProperty(globalThis, "crypto");
    }
  }
}

test("createClientSafeUuid uses crypto.randomUUID when available", () => {
  withCrypto(
    {
      randomUUID: () => "11111111-1111-4111-8111-111111111111",
    } as Crypto,
    () => {
      assert.equal(createClientSafeUuid(), "11111111-1111-4111-8111-111111111111");
    }
  );
});

test("createClientSafeUuid falls back to getRandomValues when randomUUID is absent", () => {
  withCrypto(
    {
      getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
        if (array instanceof Uint8Array) {
          array.fill(7);
        }
        return array;
      },
    } as Crypto,
    () => {
      assert.match(createClientSafeUuid(), UUID_V4_PATTERN);
    }
  );
});

test("createClientSafeUuid returns a UUID when crypto is unavailable", () => {
  withCrypto(undefined, () => {
    assert.match(createClientSafeUuid(), UUID_V4_PATTERN);
  });
});

test("createClientSafeId returns non-empty unique ids across repeated calls", () => {
  const ids = new Set<string>();
  withCrypto(undefined, () => {
    for (let index = 0; index < 1000; index += 1) {
      const id = createClientSafeId("intent");
      assert.match(id, /^intent-[0-9a-f-]+$/i);
      ids.add(id);
    }
  });
  assert.equal(ids.size, 1000);
});
