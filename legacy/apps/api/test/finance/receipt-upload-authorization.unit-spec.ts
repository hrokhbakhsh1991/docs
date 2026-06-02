import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import {
  assertActorMayUploadReceiptForRegistration,
  NOT_AUTHORIZED_TO_UPLOAD_RECEIPT_FOR_THIS_PAYMENT
} from "../../src/modules/finance/receipts/receipt-upload-authorization";
import { UserRole } from "../../src/common/auth/user-role.enum";

test("allows Admin and Owner", () => {
  assert.doesNotThrow(() =>
    assertActorMayUploadReceiptForRegistration({
      actorRole: UserRole.Admin,
      actorPhone: "+100",
      participantContactPhone: "+200"
    })
  );
  assert.doesNotThrow(() =>
    assertActorMayUploadReceiptForRegistration({
      actorRole: UserRole.Owner,
      actorPhone: null,
      participantContactPhone: "+200"
    })
  );
});

test("allows participant when phone matches", () => {
  assert.doesNotThrow(() =>
    assertActorMayUploadReceiptForRegistration({
      actorRole: UserRole.Member,
      actorPhone: "+989120001234",
      participantContactPhone: "+98 912 000 1234"
    })
  );
});

test("rejects Member with unrelated phone", () => {
  assert.throws(
    () =>
      assertActorMayUploadReceiptForRegistration({
        actorRole: UserRole.Member,
        actorPhone: "+15550001111",
        participantContactPhone: "+15550002222"
      }),
    (err: unknown) => {
      assert.ok(err instanceof ForbiddenException);
      assert.deepEqual(err.getResponse(), NOT_AUTHORIZED_TO_UPLOAD_RECEIPT_FOR_THIS_PAYMENT);
      return true;
    }
  );
});
