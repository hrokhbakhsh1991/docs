import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException } from "@nestjs/common";

import { validateStatusTransition } from "../../src/modules/registrations/registrations-policy";
import {
  RegistrationPaymentStatus,
  RegistrationStatus
} from "../../src/modules/registrations/registration.entity";

function allows(
  from: RegistrationStatus,
  to: RegistrationStatus,
  payment: RegistrationPaymentStatus = RegistrationPaymentStatus.NOT_PAID,
  options?: { treatCurrentAsWaitlisted?: boolean }
): void {
  assert.doesNotThrow(() => validateStatusTransition(from, to, payment, options));
}

function denies(
  from: RegistrationStatus,
  to: RegistrationStatus,
  payment: RegistrationPaymentStatus = RegistrationPaymentStatus.NOT_PAID,
  options?: { treatCurrentAsWaitlisted?: boolean }
): void {
  assert.throws(
    () => validateStatusTransition(from, to, payment, options),
    (e: unknown) => e instanceof ConflictException
  );
}

test("leader / payment paths aligned with booking machine (happy paths)", () => {
  allows(RegistrationStatus.PENDING, RegistrationStatus.ACCEPTED);
  allows(RegistrationStatus.PENDING, RegistrationStatus.ACCEPTED_PAID);
  allows(RegistrationStatus.PENDING, RegistrationStatus.REJECTED);
  allows(RegistrationStatus.PENDING, RegistrationStatus.CANCELLED);

  allows(RegistrationStatus.ACCEPTED, RegistrationStatus.ACCEPTED_PAID);
  allows(RegistrationStatus.ACCEPTED, RegistrationStatus.REJECTED);
  allows(RegistrationStatus.ACCEPTED, RegistrationStatus.CANCELLED);
  allows(RegistrationStatus.ACCEPTED, RegistrationStatus.NO_SHOW);

  allows(RegistrationStatus.ACCEPTED_PAID, RegistrationStatus.CANCELLED);
  allows(RegistrationStatus.ACCEPTED_PAID, RegistrationStatus.REFUNDED);
  allows(RegistrationStatus.ACCEPTED_PAID, RegistrationStatus.NO_SHOW);

  allows(RegistrationStatus.CANCELLED, RegistrationStatus.REFUNDED);
});

test("waitlisted projection: pending row treated as waitlisted may accept or cancel", () => {
  allows(RegistrationStatus.PENDING, RegistrationStatus.ACCEPTED, RegistrationPaymentStatus.NOT_PAID, {
    treatCurrentAsWaitlisted: true
  });
  allows(RegistrationStatus.PENDING, RegistrationStatus.REJECTED, RegistrationPaymentStatus.NOT_PAID, {
    treatCurrentAsWaitlisted: true
  });
});

test("terminal and downgrade transitions stay forbidden", () => {
  denies(RegistrationStatus.REFUNDED, RegistrationStatus.PENDING);
  denies(RegistrationStatus.REFUNDED, RegistrationStatus.ACCEPTED);
  denies(RegistrationStatus.CANCELLED, RegistrationStatus.PENDING);
  denies(RegistrationStatus.CANCELLED, RegistrationStatus.ACCEPTED);
  denies(RegistrationStatus.ACCEPTED_PAID, RegistrationStatus.ACCEPTED);
  denies(RegistrationStatus.REJECTED, RegistrationStatus.ACCEPTED);
});

test("accepted + recorded payment cannot move to non-confirmed legacy states", () => {
  denies(RegistrationStatus.ACCEPTED, RegistrationStatus.PENDING, RegistrationPaymentStatus.PAID);
});
