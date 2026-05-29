import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { Repository } from "typeorm";

import {
  tenantContextMissingError,
} from "../../../common/errors/error-response-builders";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { TenantDbContextService } from "../../../database/tenant-db-context.service";
import { FILE_STORAGE_PORT, FileStoragePort } from "../../../infra/storage/file-storage.port";
import { UserEntity } from "../../identity/entities/user.entity";
import { PaymentReceiptEntity, ReceiptStatus } from "../../payments/entities/payment-receipt.entity";
import { PaymentEntity, PaymentMethod, PaymentStatus } from "../../payments/entities/payment.entity";
import {
  REGISTRATION_PAYMENT_PORT,
  IRegistrationPaymentPort,
} from "../../registrations/ports/registration-payment.port";
import {
  RegistrationEntity,
  RegistrationPaymentStatus,
  RegistrationStatus,
} from "../../registrations/registration.entity";
import { validatePaymentTransition } from "../../registrations/registrations-policy";
import { lockRegistrationByTenantAndId } from "../../registrations/utils/lock-registration-for-financial-mutation";
import { BookingLedgerAuthorityService } from "../ledger/booking-ledger-authority.service";
import { PaymentCaptureLedgerAuthorityService } from "../ledger/payment-capture-ledger-authority.service";
import { FinanceReportsService } from "../reports/finance-reports.service";
import { assertActorMayUploadReceiptForRegistration } from "./receipt-upload-authorization";
import { assertNoPendingReceiptForPayment } from "./receipt-pending.policy";

@Injectable()
export class ReceiptService {
  constructor(
    @InjectRepository(PaymentReceiptEntity)
    private readonly receiptRepository: Repository<PaymentReceiptEntity>,
    @Inject(TenantDbContextService)
    private readonly tenantDbContext: TenantDbContextService,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService,
    @Inject(FILE_STORAGE_PORT)
    private readonly storage: FileStoragePort,
    @Inject(REGISTRATION_PAYMENT_PORT)
    private readonly registrationPaymentPort: IRegistrationPaymentPort,
    @Inject(FinanceReportsService)
    private readonly financeReportsService: FinanceReportsService,
    @Inject(PaymentCaptureLedgerAuthorityService)
    private readonly paymentCaptureLedgerAuthority: PaymentCaptureLedgerAuthorityService,
    @Inject(BookingLedgerAuthorityService)
    private readonly bookingLedgerAuthority: BookingLedgerAuthorityService,
  ) {}

  private resolveTenantIdOrThrow(): string {
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!tenantId) {
      throw new ForbiddenException(tenantContextMissingError());
    }
    return tenantId;
  }

  async submitReceipt(params: {
    paymentId: string;
    actorUserId: string;
    actorRole: string;
    file: Buffer;
    contentType: string;
    note?: string;
  }): Promise<PaymentReceiptEntity> {
    const tenantId = this.resolveTenantIdOrThrow();
    return this.tenantDbContext.runInTenantScope(tenantId, async (manager) => {
      const payment = await manager.findOne(PaymentEntity, {
        where: { id: params.paymentId, tenantId },
      });

      if (!payment) {
        throw new NotFoundException("Payment not found");
      }

      if (payment.method !== PaymentMethod.MANUAL) {
        throw new BadRequestException("Receipts can only be submitted for manual payments");
      }

      if (payment.status !== PaymentStatus.PENDING) {
        throw new BadRequestException(
          `Cannot submit receipt for payment with status ${payment.status}`,
        );
      }

      const registration = await manager.findOne(RegistrationEntity, {
        where: { id: payment.registrationId, tenantId },
      });
      if (!registration) {
        throw new NotFoundException("Registration not found for payment");
      }

      const actor = await manager.findOne(UserEntity, {
        where: { id: params.actorUserId },
      });
      assertActorMayUploadReceiptForRegistration({
        actorRole: params.actorRole,
        actorPhone: actor?.phone ?? null,
        participantContactPhone: registration.participantContactPhone,
      });

      const existingReceipts = await manager.find(PaymentReceiptEntity, {
        where: { paymentId: payment.id, tenantId },
        select: { status: true },
      });
      assertNoPendingReceiptForPayment(existingReceipts);

      const fileExtension = params.contentType.split("/")[1] || "bin";
      const relativePath = `receipts/${params.paymentId}/${randomUUID()}.${fileExtension}`;

      let objectKey: string | null = null;
      try {
        const uploaded = await this.storage.upload({
          workspaceId: tenantId,
          relativePath,
          body: params.file,
          contentType: params.contentType,
        });
        objectKey = uploaded.key;

        const receipt = manager.create(PaymentReceiptEntity, {
          tenantId,
          paymentId: payment.id,
          fileKey: objectKey,
          status: ReceiptStatus.PENDING,
          note: params.note ?? null,
        });

        return await manager.save(PaymentReceiptEntity, receipt);
      } catch (err) {
        if (objectKey) {
          await this.storage.deleteObject(objectKey);
        }
        throw err;
      }
    });
  }

  async approveReceipt(params: {
    receiptId: string;
    actorId: string;
    reviewNote?: string;
  }): Promise<PaymentReceiptEntity> {
    const tenantId = this.resolveTenantIdOrThrow();
    return this.tenantDbContext.runInTenantScope(tenantId, async (manager) => {
      const receipt = await manager.findOne(PaymentReceiptEntity, {
        where: { id: params.receiptId, tenantId },
        relations: ["payment"],
      });

      if (!receipt) {
        throw new NotFoundException("Receipt not found");
      }

      if (receipt.status !== ReceiptStatus.PENDING) {
        throw new BadRequestException(`Receipt already ${receipt.status}`);
      }

      const payment = receipt.payment;
      if (!payment) {
        throw new NotFoundException("Payment not found for receipt");
      }

      const regPeek = await manager.findOne(RegistrationEntity, {
        where: { id: payment.registrationId, tenantId },
        select: { id: true, tourId: true, tenantId: true },
      });
      if (!regPeek) {
        throw new NotFoundException("Registration not found for receipt payment");
      }
      await this.registrationPaymentPort.lockTourRowForUpdate(
        manager,
        regPeek.tourId,
        regPeek.tenantId,
      );
      const registration = await lockRegistrationByTenantAndId(
        manager,
        tenantId,
        payment.registrationId,
      );

      if (payment.status !== PaymentStatus.PENDING) {
        throw new BadRequestException(
          `Cannot approve receipt for payment with status ${payment.status}`,
        );
      }

      receipt.status = ReceiptStatus.APPROVED;
      receipt.reviewedByUserId = params.actorId;
      receipt.reviewedAt = new Date();
      receipt.reviewNote = params.reviewNote ?? null;

      const savedReceipt = await manager.save(PaymentReceiptEntity, receipt);

      payment.status = PaymentStatus.PAID;
      payment.paidAt = new Date();
      await manager.save(PaymentEntity, payment);

      const { journalId, lines } = await this.paymentCaptureLedgerAuthority.emitPaymentCaptureAtPaid(
        manager,
        payment,
        "manual_receipt_approve",
      );

      payment.ledgerJournalId = journalId;
      await manager.save(PaymentEntity, payment);
      savedReceipt.ledgerJournalId = journalId;
      await manager.save(PaymentReceiptEntity, savedReceipt);

      const updatedRegistration = await this.registrationPaymentPort.transitionRegistrationForPayment(
        manager,
        registration,
        RegistrationStatus.ACCEPTED_PAID,
        params.actorId,
      );
      validatePaymentTransition(
        updatedRegistration.status,
        updatedRegistration.paymentStatus,
        RegistrationPaymentStatus.PAID,
      );
      updatedRegistration.paymentStatus = RegistrationPaymentStatus.PAID;
      this.bookingLedgerAuthority.applyPaidAmountProjectionToRegistration(
        updatedRegistration,
        { paymentStatus: RegistrationPaymentStatus.PAID },
        lines,
      );
      await manager.save(RegistrationEntity, updatedRegistration);

      await this.financeReportsService.invalidateSummaryCache();
      return savedReceipt;
    });
  }

  async rejectReceipt(params: {
    receiptId: string;
    actorId: string;
    reviewNote?: string;
  }): Promise<PaymentReceiptEntity> {
    const tenantId = this.resolveTenantIdOrThrow();
    return this.tenantDbContext.runInTenantScope(tenantId, async (manager) => {
      const receipt = await manager.findOne(PaymentReceiptEntity, {
        where: { id: params.receiptId, tenantId },
      });

      if (!receipt) {
        throw new NotFoundException("Receipt not found");
      }

      if (receipt.status !== ReceiptStatus.PENDING) {
        throw new BadRequestException(`Receipt already ${receipt.status}`);
      }

      receipt.status = ReceiptStatus.REJECTED;
      receipt.reviewedByUserId = params.actorId;
      receipt.reviewedAt = new Date();
      receipt.reviewNote = params.reviewNote ?? null;

      const saved = await manager.save(PaymentReceiptEntity, receipt);
      await this.financeReportsService.invalidateSummaryCache();
      return saved;
    });
  }

  async getReceiptSignedUrl(params: { receiptId: string }): Promise<string> {
    const tenantId = this.resolveTenantIdOrThrow();
    const receipt = await this.receiptRepository.findOne({
      where: { id: params.receiptId, tenantId },
    });

    if (!receipt) {
      throw new NotFoundException("Receipt not found");
    }

    return this.storage.getSignedUrl(receipt.fileKey, 3600);
  }

  async listPendingReceipts(): Promise<PaymentReceiptEntity[]> {
    const tenantId = this.resolveTenantIdOrThrow();
    return this.receiptRepository.find({
      where: { tenantId, status: ReceiptStatus.PENDING },
      relations: ["payment"],
      order: { createdAt: "ASC" },
      take: 100,
    });
  }
}
