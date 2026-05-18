import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { PaymentWebhookSignatureGuard } from "../../src/modules/payments/payments-webhook-signature.guard";

const SECRET = "test-webhook-signing-secret-0123456789";
const NOW_SEC = Math.floor(Date.now() / 1000);

function sign(rawBody: Buffer, ts: string): string {
  return createHmac("sha256", SECRET)
    .update(Buffer.concat([Buffer.from(`${ts}.`, "utf8"), rawBody]))
    .digest("hex");
}

function makeContext(req: { rawBody?: Buffer; header: (name: string) => string | undefined }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req
    })
  } as unknown as ExecutionContext;
}

function makeGuard() {
  const configService = {
    getNodeEnv: () => "test",
    getPaymentsWebhookAllowedIps: () => [],
    getTrustedProxyCidrs: () => [],
    getPaymentsWebhookSigningSecret: () => SECRET,
    getPaymentsWebhookSigningSecretPrevious: () => ""
  };
  return new PaymentWebhookSignatureGuard(configService as never, null);
}

test("rejects webhook when signature headers are missing", async () => {
  const guard = makeGuard();
  const rawBody = Buffer.from('{"hello":"world"}');
  const req = {
    rawBody,
    header: (_name: string) => undefined
  };

  await assert.rejects(
    async () => guard.canActivate(makeContext(req)),
    (error: unknown) => {
      assert.ok(error instanceof UnauthorizedException);
      const response = error.getResponse() as { error?: { code?: string } };
      assert.equal(response.error?.code, "WEBHOOK_SIGNATURE_INVALID");
      return true;
    }
  );
});

test("rejects webhook when signature is invalid", async () => {
  const guard = makeGuard();
  const rawBody = Buffer.from('{"providerPaymentId":"x"}');
  const ts = String(NOW_SEC);
  const req = {
    rawBody,
    header: (name: string) => {
      if (name.toLowerCase() === "x-payments-webhook-timestamp") return ts;
      if (name.toLowerCase() === "x-payments-webhook-signature") return "v1=deadbeef";
      return undefined;
    }
  };

  await assert.rejects(
    async () => guard.canActivate(makeContext(req)),
    (error: unknown) => {
      assert.ok(error instanceof UnauthorizedException);
      const response = error.getResponse() as { error?: { code?: string } };
      assert.equal(response.error?.code, "WEBHOOK_SIGNATURE_INVALID");
      return true;
    }
  );
});

test("rejects webhook when timestamp is expired", async () => {
  const guard = makeGuard();
  const rawBody = Buffer.from('{"providerPaymentId":"x"}');
  const ts = String(NOW_SEC - 1000);
  const sig = sign(rawBody, ts);
  const req = {
    rawBody,
    header: (name: string) => {
      if (name.toLowerCase() === "x-payments-webhook-timestamp") return ts;
      if (name.toLowerCase() === "x-payments-webhook-signature") return sig;
      return undefined;
    }
  };

  await assert.rejects(
    async () => guard.canActivate(makeContext(req)),
    (error: unknown) => {
      assert.ok(error instanceof UnauthorizedException);
      const response = error.getResponse() as { error?: { code?: string } };
      assert.equal(response.error?.code, "WEBHOOK_TIMESTAMP_EXPIRED");
      return true;
    }
  );
});

test("rejects replayed webhook signature+timestamp pair", async () => {
  const guard = makeGuard();
  const rawBody = Buffer.from('{"providerPaymentId":"x","status":"Paid"}');
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = sign(rawBody, ts);
  const req = {
    rawBody,
    header: (name: string) => {
      if (name.toLowerCase() === "x-payments-webhook-timestamp") return ts;
      if (name.toLowerCase() === "x-payments-webhook-signature") return sig;
      return undefined;
    }
  };

  assert.equal(await guard.canActivate(makeContext(req)), true);
  await assert.rejects(
    async () => guard.canActivate(makeContext(req)),
    (error: unknown) => {
      assert.ok(error instanceof UnauthorizedException);
      const response = error.getResponse() as { error?: { code?: string } };
      assert.equal(response.error?.code, "WEBHOOK_REPLAY_DETECTED");
      return true;
    }
  );
});
