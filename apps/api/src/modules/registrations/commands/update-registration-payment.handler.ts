import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Inject, NotFoundException, ConflictException } from "@nestjs/common";
import { UpdateRegistrationPaymentCommand } from "../domain/commands/update-registration-payment.command";
import { 
  REGISTRATIONS_READ_REPOSITORY_PORT, 
  type RegistrationsReadRepositoryPort 
} from "../domain/ports/registrations-read.port";
import {
  REGISTRATIONS_WRITE_REPOSITORY_PORT,
  type RegistrationsWriteRepositoryPort
} from "../domain/ports/registrations-write.port";
import { validatePaymentAmountConsistency, validatePaymentTransition } from "../registrations-policy";

@CommandHandler(UpdateRegistrationPaymentCommand)
export class UpdateRegistrationPaymentHandler implements ICommandHandler<UpdateRegistrationPaymentCommand> {
  constructor(
    @Inject(REGISTRATIONS_READ_REPOSITORY_PORT)
    private readonly readPort: RegistrationsReadRepositoryPort,
    @Inject(REGISTRATIONS_WRITE_REPOSITORY_PORT)
    private readonly writePort: RegistrationsWriteRepositoryPort
  ) {}

  async execute(command: UpdateRegistrationPaymentCommand): Promise<void> {
    const registration = await this.readPort.lockForFinancialMutation({
      id: command.registrationId,
      tenantId: command.tenantId,
    });

    if (!registration) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Resource not found in tenant scope"
        }
      });
    }

    if (registration.rowVersion !== command.expected_row_version) {
      throw new ConflictException({
        error: {
          code: "OPTIMISTIC_LOCK_VERSION_MISMATCH",
          message: `Expected version ${command.expected_row_version} but found ${registration.rowVersion}`
        }
      });
    }

    validatePaymentTransition(
      registration.status,
      registration.paymentStatus,
      command.paymentStatus
    );
    const paidAmountMinor =
      command.paidAmount !== undefined ? Number(command.paidAmount) : undefined;
    validatePaymentAmountConsistency(command.paymentStatus, paidAmountMinor);

    await this.writePort.saveRegistrationPaymentUpdate(
      registration,
      command.paymentStatus,
      command.paidAmount,
      command.idempotencyKey,
      command.actorId
    );
  }
}
