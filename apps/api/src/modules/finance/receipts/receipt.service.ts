import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TenantDbContextService } from "../../../database/tenant-db-context.service";
import { FILE_STORAGE_PORT, FileStoragePort } from "../../../infra/storage/file-storage.port";
import { PaymentReceiptEntity, ReceiptStatus } from "../../payments/entities/payment-receipt.entity";
import { PaymentEntity, PaymentStatus, PaymentMethod } from "../../payments/entities/payment.entity";
import { randomUUID } from "node:crypto";
import {
  REGISTRATION_PAYMENT_PORT,
  IRegistrationPaymentPort
} from "../../registrations/ports/registration-payment.port";
import {
  RegistrationEntity,
  RegistrationPaymentStatus,
  RegistrationStatus
} from "../../registrations/registration.entity";
import { validatePaymentTransition } from "../../registrations/registrations-policy";
import { PaymentCaptureLedgerAuthorityService } from "../ledger/payment-capture-ledger-authority.service";
import { FinanceReportsService } from "../reports/finance-reports.service";
import { assertActorMayUploadReceiptForRegistration } from "./receipt-upload-authorization";
import { assertNoPendingReceiptForPayment } from "./receipt-pending.policy";
import { UserEntity } from "../../identity/entities/user.entity";

@Injectable()
export class ReceiptService {
  constructor(
    @InjectRepository(PaymentReceiptEntity)
    private readonly receiptRepository: Repository<PaymentReceiptEntity>,
    @Inject(TenantDbContextService)
    private readonly tenantDbContext: TenantDbContextService,
    @Inject(FILE_STORAGE_PORT)
    private readonly storage: FileStoragePort,
    @Inject(REGISTRATION_PAYMENT_PORT)
    private readonly registrationPaymentPort: IRegistrationPaymentPort,
    @Inject(FinanceReportsService)
    private readonly financeReportsService: FinanceReportsService,
    @Inject(PaymentCaptureLedgerAuthorityService)
    private readonly paymentCaptureLedgerAuthority: PaymentCaptureLedgerAuthorityService
  ) {}

  async submitReceipt(params: {
    tenantId: string;
    paymentId: string;
    actorUserId: string;
    actorRole: string;
    file: Buffer;
    contentType: string;
    note?: string;
  }): Promise<PaymentReceiptEntity> {
    return this.tenantDbContext.runInTenantScope(params.tenantId, async (manager) => {
      const payment = await manager.findOne(PaymentEntity, {
        where: { id: params.paymentId, tenantId: params.tenantId }
      });

      if (!payment) {
        throw new NotFoundException("Payment not found");
      }

      if (payment.method !== PaymentMethod.MANUAL) {
        throw new BadRequestException("Receipts can only be submitted for manual payments");
      }

      if (payment.status !== PaymentStatus.PENDING) {
        throw new BadRequestException(
          `Cannot submit receipt for payment with status ${payment.status}`
        );
      }

      const registration = await manager.findOne(RegistrationEntity, {
        where: { id: payment.registrationId, tenantId: params.tenantId }
      });
      if (!registration) {
        throw new NotFoundException("Registration not found for payment");
      }

      const actor = await manager.findOne(UserEntity, {
        where: { id: params.actorUserId }
      });
      assertActorMayUploadReceiptForRegistration({
        actorRole: params.actorRole,
        actorPhone: actor?.phone ?? null,
        participantContactPhone: registration.participantContactPhone
      });

      const existingReceipts = await manager.find(PaymentReceiptEntity, {
        where: { paymentId: payment.id, tenantId: params.tenantId },
        select: { status: true }
      });
      assertNoPendingReceiptForPayment(existingReceipts);

      const fileExtension = params.contentType.split("/")[1] || "bin";
      const relativePath = `receipts/${params.paymentId}/${randomUUID()}.${fileExtension}`;

      let objectKey: string | null = null;
      try {
        const uploaded = await this.storage.upload({
          workspaceId: params.tenantId,
          relativePath,
          body: params.file,
          contentType: params.contentType
        });
        objectKey = uploaded.key;

        const receipt = manager.create(PaymentReceiptEntity, {
          tenantId: params.tenantId,
          paymentId: payment.id,
          fileKey: objectKey,
          status: ReceiptStatus.PENDING,
          note: params.note ?? null
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
    tenantId: string;
    receiptId: string;
    actorId: string;
    reviewNote?: string;
  }): Promise<PaymentReceiptEntity> {
    return this.tenantDbContext.runInTenantScope(params.tenantId, async (manager) => {
      const receipt = await manager.findOne(PaymentReceiptEntity, {
        where: { id: params.receiptId, tenantId: params.tenantId },
        relations: ["payment", "payment.registration"]
      });

      if (!receipt) {
        throw new NotFoundException("Receipt not found");
      }

      if (receipt.status !== ReceiptStatus.PENDING) {
        throw new BadRequestException(`Receipt already ${receipt.status}`);
      }

      receipt.status = ReceiptStatus.APPROVED;
      receipt.reviewedByUserId = params.actorId;
      receipt.reviewedAt = new Date();
      receipt.reviewNote = params.reviewNote ?? null;

      const savedReceipt = await manager.save(PaymentReceiptEntity, receipt);

      const payment = receipt.payment;
      payment.status = PaymentStatus.PAID;
      payment.paidAt = new Date();
      await manager.save(PaymentEntity, payment);
      await this.paymentCaptureLedgerAuthority.emitPaymentCaptureAtPaid(
        manager,
        payment,
        "manual_receipt_approve"
      );

      const registration = await manager.findOne(RegistrationEntity, {
        where: { id: payment.registrationId, tenantId: params.tenantId }
      });
      if (!registration) {
        throw new NotFoundException("Registration not found for payment");
      }

      const updatedRegistration = await this.registrationPaymentPort.transitionRegistrationForPayment(
        manager,
        registration,
        RegistrationStatus.ACCEPTED_PAID,
        params.actorId
      );
      validatePaymentTransition(
        updatedRegistration.status,
        updatedRegistration.paymentStatus,
        RegistrationPaymentStatus.PAID
      );
      updatedRegistration.paymentStatus = RegistrationPaymentStatus.PAID;
      updatedRegistration.paidAmount = payment.amount;
      await manager.save(RegistrationEntity, updatedRegistration);

      await this.financeReportsService.invalidateSummaryCache(params.tenantId);
      return savedReceipt;
    });
  }

  async rejectReceipt(params: {
    tenantId: string;
    receiptId: string;
    actorId: string;
    reviewNote?: string;
  }): Promise<PaymentReceiptEntity> {
    return this.tenantDbContext.runInTenantScope(params.tenantId, async (manager) => {
      const receipt = await manager.findOne(PaymentReceiptEntity, {
        where: { id: params.receiptId, tenantId: params.tenantId }
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
      await this.financeReportsService.invalidateSummaryCache(params.tenantId);
      return saved;
    });
  }

  async getReceiptSignedUrl(params: {
    tenantId: string;
    receiptId: string;
  }): Promise<string> {
    const receipt = await this.receiptRepository.findOne({
      where: { id: params.receiptId, tenantId: params.tenantId }
    });

    if (!receipt) {
      throw new NotFoundException("Receipt not found");
    }

    return this.storage.getSignedUrl(receipt.fileKey, 3600);
  }

  async listPendingReceipts(tenantId: string): Promise<PaymentReceiptEntity[]> {
    return this.receiptRepository.find({
      where: { tenantId, status: ReceiptStatus.PENDING },
      relations: ["payment"],
      order: { createdAt: "ASC" },
      take: 100
    });
  }
}
