import { RegistrationPaymentStatus } from "../registration-status";

export class UpdateRegistrationPaymentCommand {
  constructor(
    public readonly registrationId: string,
    public readonly tenantId: string,
    public readonly paymentStatus: RegistrationPaymentStatus,
    public readonly paidAmount: string | undefined,
    public readonly expected_row_version: number,
    public readonly idempotencyKey: string,
    public readonly actorId: string
  ) {}
}
