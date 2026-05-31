import assert from "node:assert/strict";
import test from "node:test";

import { TenantPaymentConfigCachePubSubListener } from "../../../src/modules/payments/subscribers/tenant-payment-config-cache-pubsub.listener";
import { TenantPaymentConfigService } from "../../../src/modules/payments/services/tenant-payment-config.service";
import { TENANT_PAYMENT_CONFIG_INVALIDATE_CHANNEL_PATTERN } from "../../../src/modules/payments/tenant-payment-config-cache.constants";

const TENANT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type HarnessHandlers = {
  pmessage: ((pattern: string, channel: string, message: string) => void) | null;
  ready: (() => void) | null;
  reconnecting: ((delayMs: number) => void) | null;
  end: (() => void) | null;
  error: ((error: Error) => void) | null;
};

function makeListenerHarness(): {
  listener: TenantPaymentConfigCachePubSubListener;
  invalidations: string[];
  handlers: HarnessHandlers;
  psubscribeCalls: string[];
} {
  const invalidations: string[] = [];
  const psubscribeCalls: string[] = [];
  const handlers: HarnessHandlers = {
    pmessage: null,
    ready: null,
    reconnecting: null,
    end: null,
    error: null,
  };

  const subscriber = {
    on(event: string, handler: (...args: unknown[]) => void) {
      if (event === "pmessage") {
        handlers.pmessage = handler as HarnessHandlers["pmessage"];
      }
      if (event === "ready") {
        handlers.ready = handler as HarnessHandlers["ready"];
      }
      if (event === "reconnecting") {
        handlers.reconnecting = handler as HarnessHandlers["reconnecting"];
      }
      if (event === "end") {
        handlers.end = handler as HarnessHandlers["end"];
      }
      if (event === "error") {
        handlers.error = handler as HarnessHandlers["error"];
      }
    },
    async psubscribe(pattern: string) {
      psubscribeCalls.push(pattern);
    },
    status: "ready",
    async quit() {},
    disconnect() {},
  };

  const service = {
    invalidateTenant(tenantId: string) {
      invalidations.push(tenantId);
    },
  } as unknown as TenantPaymentConfigService;

  const listener = new TenantPaymentConfigCachePubSubListener(
    {
      duplicate() {
        return subscriber;
      },
    } as never,
    service,
    {
      warn() {},
      info() {},
      debug() {},
      error() {},
    } as never,
  );

  listener.onModuleInit();
  return { listener, invalidations, handlers, psubscribeCalls };
}

test("TenantPaymentConfigCachePubSubListener flushes local cache on invalidation channel", async () => {
  const { invalidations, handlers } = makeListenerHarness();
  assert.ok(handlers.pmessage);

  handlers.pmessage!(
    TENANT_PAYMENT_CONFIG_INVALIDATE_CHANNEL_PATTERN,
    `tenant_payment_config:invalidate:${TENANT_ID}`,
    TENANT_ID,
  );

  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.deepEqual(invalidations, [TENANT_ID]);
});

test("TenantPaymentConfigCachePubSubListener coalesces burst invalidations into one flush", async () => {
  const { invalidations, handlers } = makeListenerHarness();
  assert.ok(handlers.pmessage);

  const channel = `tenant_payment_config:invalidate:${TENANT_ID}`;
  for (let index = 0; index < 50; index += 1) {
    handlers.pmessage!(
      TENANT_PAYMENT_CONFIG_INVALIDATE_CHANNEL_PATTERN,
      channel,
      TENANT_ID,
    );
  }

  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.deepEqual(invalidations, [TENANT_ID]);
});

test("TenantPaymentConfigCachePubSubListener batches distinct tenants in one flush cycle", async () => {
  const { invalidations, handlers } = makeListenerHarness();
  assert.ok(handlers.pmessage);

  const tenantB = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  handlers.pmessage!(
    TENANT_PAYMENT_CONFIG_INVALIDATE_CHANNEL_PATTERN,
    `tenant_payment_config:invalidate:${TENANT_ID}`,
    TENANT_ID,
  );
  handlers.pmessage!(
    TENANT_PAYMENT_CONFIG_INVALIDATE_CHANNEL_PATTERN,
    `tenant_payment_config:invalidate:${tenantB}`,
    tenantB,
  );
  handlers.pmessage!(
    TENANT_PAYMENT_CONFIG_INVALIDATE_CHANNEL_PATTERN,
    `tenant_payment_config:invalidate:${TENANT_ID}`,
    TENANT_ID,
  );

  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.deepEqual(invalidations, [TENANT_ID, tenantB]);
});

test("TenantPaymentConfigCachePubSubListener psubscribes on init and resubscribes after end", async () => {
  const { handlers, psubscribeCalls } = makeListenerHarness();
  assert.ok(psubscribeCalls.includes(TENANT_PAYMENT_CONFIG_INVALIDATE_CHANNEL_PATTERN));
  assert.ok(handlers.end);

  handlers.end!();

  await new Promise<void>((resolve) => setTimeout(resolve, 1_050));

  assert.ok(
    psubscribeCalls.filter((pattern) => pattern === TENANT_PAYMENT_CONFIG_INVALIDATE_CHANNEL_PATTERN)
      .length >= 2,
    "expected exponential backoff resubscription after connection end",
  );
});

test("TenantPaymentConfigCachePubSubListener drops concurrent ensureSubscribed while lock is held", async () => {
  let releasePsubscribe: (() => void) | undefined;
  const psubscribeGate = new Promise<void>((resolve) => {
    releasePsubscribe = resolve;
  });
  const psubscribeCalls: string[] = [];

  const subscriber = {
    on() {},
    async psubscribe(pattern: string) {
      psubscribeCalls.push(pattern);
      await psubscribeGate;
    },
    status: "ready",
    async quit() {},
    disconnect() {},
  };

  const listener = new TenantPaymentConfigCachePubSubListener(
    { duplicate: () => subscriber } as never,
    { invalidateTenant() {} } as never,
    { warn() {}, info() {}, debug() {}, error() {} } as never,
  );

  listener.onModuleInit();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(psubscribeCalls.length, 1);

  const concurrent = [
    listener["ensureSubscribed"]("ready"),
    listener["ensureSubscribed"]("reconnecting"),
    listener["ensureSubscribed"]("error"),
  ];
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(psubscribeCalls.length, 1);

  releasePsubscribe?.();
  await Promise.all(concurrent);
  assert.equal(psubscribeCalls.length, 1);
});

test("TenantPaymentConfigCachePubSubListener resubscribes on ready reconnect", async () => {
  const { handlers, psubscribeCalls } = makeListenerHarness();
  await new Promise<void>((resolve) => setImmediate(resolve));
  const initialCount = psubscribeCalls.length;
  assert.ok(handlers.ready);
  assert.ok(initialCount >= 1);

  handlers.ready!();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.ok(psubscribeCalls.length > initialCount);
});
