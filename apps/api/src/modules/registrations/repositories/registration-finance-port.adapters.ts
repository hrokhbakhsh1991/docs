import { Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { In } from "typeorm";

import type { RegistrationFinancialRecord } from "../../../common/contracts/registration-financial.types";
import type { FinanceReceiptActorPort } from "../../../common/ports/finance-receipt-actor.port";
import type { RegistrationFinancialMutationPort } from "../../../common/ports/registration-financial-mutation.port";
import type { ReconciliationRegistrationReadPort } from "../../../common/ports/reconciliation-registration-read.port";
import { UserEntity } from "../../identity/entities/user.entity";
import {
  RegistrationEntity,
  RegistrationPaymentStatus,
  RegistrationStatus,
} from "../registration.entity";
import { validatePaymentTransition } from "../registrations-policy";
import { lockRegistrationByTenantAndId } from "./lock-registration-for-financial-mutation";

const asFinancialRecord = (row: RegistrationEntity): RegistrationFinancialRecord => ({
  id: row.id,
  tenantId: row.tenantId,
  tourId: row.tourId,
  status: row.status as RegistrationFinancialRecord["status"],
  paymentStatus: row.paymentStatus as RegistrationFinancialRecord["paymentStatus"],
  participantContactPhone: row.participantContactPhone ?? null,
  paidAmount: row.paidAmount ?? null,
  quotedCurrencyCode: row.quotedCurrencyCode ?? null,
});

@Injectable()
export class RegistrationFinancialMutationAdapter implements RegistrationFinancialMutationPort {
  async findRegistrationForReceipt(
    manager: EntityManager,
    tenantId: string,
    registrationId: string
  ): Promise<RegistrationFinancialRecord | null> {
    const row = await manager.findOne(RegistrationEntity, {
      where: { id: registrationId, tenantId },
    });
    return row ? asFinancialRecord(row) : null;
  }

  async findRegistrationPeekForReceipt(
    manager: EntityManager,
    tenantId: string,
    registrationId: string
  ): Promise<Pick<RegistrationFinancialRecord, "id" | "tourId" | "tenantId"> | null> {
    const row = await manager.findOne(RegistrationEntity, {
      where: { id: registrationId, tenantId },
      select: { id: true, tourId: true, tenantId: true },
    });
    return row ? { id: row.id, tourId: row.tourId, tenantId: row.tenantId } : null;
  }

  lockRegistrationByTenantAndId(
    manager: EntityManager,
    tenantId: string,
    registrationId: string
  ): Promise<RegistrationFinancialRecord> {
    return lockRegistrationByTenantAndId(manager, tenantId, registrationId).then((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      tourId: row.tourId,
      status: row.status as RegistrationFinancialRecord["status"],
      paymentStatus: row.paymentStatus as RegistrationFinancialRecord["paymentStatus"],
      participantContactPhone: row.participantContactPhone ?? null,
      paidAmount: row.paidAmount ?? null,
      quotedCurrencyCode: row.quotedCurrencyCode ?? null,
    }));
  }

  validatePaymentTransition(
    registrationStatus: RegistrationFinancialRecord["status"],
    currentPaymentStatus: RegistrationFinancialRecord["paymentStatus"],
    nextPaymentStatus: RegistrationFinancialRecord["paymentStatus"]
  ): void {
    validatePaymentTransition(
      registrationStatus as RegistrationStatus,
      currentPaymentStatus as RegistrationPaymentStatus,
      nextPaymentStatus as RegistrationPaymentStatus
    );
  }

  async saveRegistrationFinancialRecord(
    manager: EntityManager,
    record: RegistrationFinancialRecord
  ): Promise<RegistrationFinancialRecord> {
    const entity = await manager.findOne(RegistrationEntity, {
      where: { id: record.id, tenantId: record.tenantId },
    });
    if (!entity) {
      throw new Error(`Registration ${record.id} not found for save`);
    }
    entity.status = record.status as RegistrationStatus;
    entity.paymentStatus = record.paymentStatus as RegistrationPaymentStatus;
    if (record.paidAmount !== undefined) {
      entity.paidAmount = record.paidAmount;
    }
    const saved = await manager.save(RegistrationEntity, entity);
    return asFinancialRecord(saved);
  }
}

@Injectable()
export class FinanceReceiptActorAdapter implements FinanceReceiptActorPort {
  async getUserPhoneForReceiptUpload(
    manager: EntityManager,
    userId: string
  ): Promise<string | null> {
    const user = await manager.findOne(UserEntity, {
      where: { id: userId },
    });
    return user?.phone ?? null;
  }
}

@Injectable()
export class ReconciliationRegistrationReadAdapter implements ReconciliationRegistrationReadPort {
  async loadRegistrationProjections(
    manager: EntityManager,
    tenantId: string,
    registrationIds: readonly string[]
  ) {
    if (registrationIds.length === 0) {
      return [];
    }
    const rows = await manager.find(RegistrationEntity, {
      where: { tenantId, id: In([...registrationIds]) },
      select: {
        id: true,
        paidAmount: true,
        quotedCurrencyCode: true,
        paymentStatus: true,
      },
    });
    return rows.map((r) => ({
      bookingId: r.id,
      paidAmountMinor:
        r.paidAmount !== undefined && r.paidAmount !== null ? String(r.paidAmount) : null,
      quotedCurrencyCode: r.quotedCurrencyCode ?? null,
      paymentStatus: String(r.paymentStatus),
    }));
  }
}
