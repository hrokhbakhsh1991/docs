import assert from "node:assert/strict";
import test from "node:test";

import { costContextRequiresPayment, toUpdateTourApiBody } from "./tours.service";
import type { UpdateTourDto } from "./tours.service";

const baseDto: UpdateTourDto = {
  title: "Test tour title here",
  capacity: 10,
  price: 100,
  lifecycle_status: "DRAFT",
};

test("costContextRequiresPayment tolerates snake_case", () => {
  assert.equal(costContextRequiresPayment({ requires_payment: true }), true);
  assert.equal(costContextRequiresPayment({ requiresPayment: true }), true);
  assert.equal(costContextRequiresPayment({}), false);
});

test("toUpdateTourApiBody retains existing requiresPayment when dto omits flag", () => {
  const body = toUpdateTourApiBody(baseDto, {
    currency: "IRR",
    totalCost: 500_000,
    requiresPayment: true,
    paymentMode: "offline_receipt",
  });
  const cost = body.cost_context as Record<string, unknown>;
  assert.equal(cost.requiresPayment, true);
  assert.equal(cost.paymentMode, "offline_receipt");
});

test("toUpdateTourApiBody sets requiresPayment when dto explicitly enables paid tour", () => {
  const body = toUpdateTourApiBody({ ...baseDto, requiresPayment: true }, {});
  const cost = body.cost_context as Record<string, unknown>;
  assert.equal(cost.requiresPayment, true);
});

test("toUpdateTourApiBody omits requiresPayment when neither dto nor existing context is paid", () => {
  const body = toUpdateTourApiBody(baseDto, { currency: "USD", totalCost: 50 });
  const cost = body.cost_context as Record<string, unknown>;
  assert.equal("requiresPayment" in cost, false);
});

test("toUpdateTourApiBody stringifies totalCost for wire ingress", () => {
  const body = toUpdateTourApiBody(baseDto, {});
  const cost = body.cost_context as Record<string, unknown>;
  assert.equal(cost.totalCost, "100");
});

test("toUpdateTourApiBody omits lifecycle_status when dto omits it", () => {
  const { lifecycle_status: _removed, ...fieldEditDto } = baseDto;
  const body = toUpdateTourApiBody(fieldEditDto, {});
  assert.equal("lifecycle_status" in body, false);
});
