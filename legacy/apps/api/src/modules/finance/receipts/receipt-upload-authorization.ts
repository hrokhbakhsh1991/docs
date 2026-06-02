import { ForbiddenException } from "@nestjs/common";
import { canUploadReceiptAsWorkspaceStaff } from "../../../common/rbac/workspace-access.helper";

export const NOT_AUTHORIZED_TO_UPLOAD_RECEIPT_FOR_THIS_PAYMENT = {
  error: {
    code: "NOT_AUTHORIZED_TO_UPLOAD_RECEIPT_FOR_THIS_PAYMENT",
    message: "You are not allowed to upload a receipt for this payment"
  }
} as const;

function normalizePhone(phone: string | null | undefined): string {
  return String(phone ?? "")
    .trim()
    .replace(/\s+/g, "");
}

/**
 * Pilot policy (map-phase D8): workspace Admin/Owner, or participant phone match.
 * Leader-of-tour check can be added when registration↔user linkage exists on the row.
 */
export function assertActorMayUploadReceiptForRegistration(input: {
  actorRole: string | null | undefined;
  actorPhone: string | null | undefined;
  participantContactPhone: string;
}): void {
  if (canUploadReceiptAsWorkspaceStaff(input.actorRole)) {
    return;
  }

  const actorPhone = normalizePhone(input.actorPhone);
  const participantPhone = normalizePhone(input.participantContactPhone);
  if (actorPhone.length > 0 && participantPhone.length > 0 && actorPhone === participantPhone) {
    return;
  }

  throw new ForbiddenException(NOT_AUTHORIZED_TO_UPLOAD_RECEIPT_FOR_THIS_PAYMENT);
}
