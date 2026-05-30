import type { RegistrationPaymentStatus } from "../registration-status";
import type { RegistrationWriteRecord } from "../registration-write.types";

export const REGISTRATIONS_WRITE_REPOSITORY_PORT = Symbol("REGISTRATIONS_WRITE_REPOSITORY_PORT");

export interface RegistrationsWriteRepositoryPort {
  saveRegistrationPaymentUpdate(
    registration: RegistrationWriteRecord,
    paymentStatus: RegistrationPaymentStatus,
    paidAmount: string | undefined,
    idempotencyKey: string,
    actorId: string
  ): Promise<RegistrationWriteRecord>;
}
