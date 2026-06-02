import type { RegistrationReadDetailRecord } from "../domain/registration-read-detail.types";
import type { TourCapacityPolicySnapshot } from "../domain/registration-policy.types";
import type { TourBookingLockRecord } from "../domain/registration-write.types";
import type { TourCatalogSnapshot } from "../domain/ports/registrations-tour-catalog.port";
import {
  RegistrationResponseDto,
  WaitlistItemResponseDto,
} from "../dto/get-registration.dto";
import { RegistrationEntity } from "../registration.entity";
import { WaitlistItemEntity } from "../waitlist-item.entity";
import { TourLifecycleStatus } from "@repo/domain-contracts";
import type { RegistrationWriteRecord } from "../domain/registration-write.types";

export const asRegistrationWriteRecord = (row: RegistrationEntity): RegistrationWriteRecord => ({
  id: row.id,
  tenantId: row.tenantId,
  tourId: row.tourId,
  tourDepartureId: row.tourDepartureId ?? null,
  status: row.status,
  paymentStatus: row.paymentStatus,
  participantContactPhone: row.participantContactPhone ?? null,
  telegramUserId: row.telegramUserId ?? null,
  quotedTotalMinor: row.quotedTotalMinor ?? null,
  quotedCurrencyCode: row.quotedCurrencyCode ?? null,
  paidAmount: row.paidAmount ?? null,
  rowVersion: row.rowVersion ?? null,
  deletedAt: row.deletedAt ?? null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export function tourCapacityPolicyFromCatalogSnapshot(
  tour: TourCatalogSnapshot,
): TourCapacityPolicySnapshot {
  return {
    lifecycleStatus: tour.lifecycleStatus as TourLifecycleStatus,
    acceptedCount: tour.acceptedCount,
    totalCapacity: tour.totalCapacity,
  };
}

export const asTourBookingLockRecord = (tour: TourCatalogSnapshot): TourBookingLockRecord => ({
  id: tour.id,
  tenantId: tour.tenantId,
  tourId: tour.id,
  lifecycleStatus: tour.lifecycleStatus,
  acceptedCount: tour.acceptedCount,
  totalCapacity: tour.totalCapacity,
  autoAcceptRegistrations: tour.autoAcceptRegistrations ?? null,
  costContext: (tour.costContext as Record<string, unknown> | null) ?? null,
  details: tour.details ? { tripDetails: tour.details.tripDetails as Record<string, unknown> | null } : null,
  tourDepartureId: tour.tourDepartureId ?? null,
});

export function toRegistrationResponse(entity: RegistrationEntity): RegistrationResponseDto {
  return {
    id: entity.id,
    tenantId: entity.tenantId,
    tourId: entity.tourId,
    participantFullName: entity.participantFullName,
    participantContactPhone: entity.participantContactPhone,
    bookingTarget: entity.bookingTarget,
    participantNationalId: entity.participantNationalId,
    transportMode: entity.transportMode,
    entryMode: entity.entryMode,
    telegramUserId: entity.telegramUserId,
    telegramUsername: entity.telegramUsername,
    vehicleSeatCapacity: entity.vehicleSeatCapacity,
    participantNote: entity.participantNote,
    participantMetadata: entity.participantMetadata ?? null,
    status: entity.status,
    rowVersion: entity.rowVersion,
    paymentStatus: entity.paymentStatus,
    paidAmount: entity.paidAmount,
    payment:
      entity.paymentMetadata &&
      typeof entity.paymentMetadata.provider === "string" &&
      typeof entity.paymentMetadata.currency === "string" &&
      typeof entity.paymentMetadata.amount === "string"
        ? {
            status:
              typeof entity.paymentMetadata.status === "string"
                ? entity.paymentMetadata.status
                : "Pending",
            amount: entity.paymentMetadata.amount,
            currency: entity.paymentMetadata.currency,
            method:
              typeof entity.paymentMetadata.method === "string"
                ? entity.paymentMetadata.method
                : "Online",
            provider: entity.paymentMetadata.provider,
            providerPaymentId:
              typeof entity.paymentMetadata.providerPaymentId === "string"
                ? entity.paymentMetadata.providerPaymentId
                : null,
          }
        : undefined,
    lockedPricing:
      entity.quotedTotalMinor != null &&
      entity.quotedCurrencyCode != null &&
      entity.quotedPricingVersion != null
        ? {
            totalMinor: String(entity.quotedTotalMinor),
            currency: String(entity.quotedCurrencyCode).trim().toUpperCase(),
            pricingRuleVersion: String(entity.quotedPricingVersion),
            listPriceMinor:
              entity.quotedListPriceMinor != null ? String(entity.quotedListPriceMinor) : null,
          }
        : null,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

export function toRegistrationResponseFromDetail(
  detail: RegistrationReadDetailRecord,
): RegistrationResponseDto {
  const paymentMetadata = detail.paymentMetadata;
  return {
    id: detail.id,
    tenantId: detail.tenantId,
    tourId: detail.tourId,
    participantFullName: detail.participantFullName,
    participantContactPhone: detail.participantContactPhone,
    bookingTarget: detail.bookingTarget ?? undefined,
    participantNationalId: detail.participantNationalId ?? undefined,
    transportMode: detail.transportMode,
    entryMode: detail.entryMode,
    telegramUserId: detail.telegramUserId ?? undefined,
    telegramUsername: detail.telegramUsername ?? undefined,
    vehicleSeatCapacity: detail.vehicleSeatCapacity ?? undefined,
    participantNote: detail.participantNote ?? undefined,
    participantMetadata: detail.participantMetadata ?? null,
    status: detail.status,
    rowVersion: detail.rowVersion ?? 1,
    paymentStatus: detail.paymentStatus,
    paidAmount: detail.paidAmount ?? undefined,
    payment:
      paymentMetadata &&
      typeof paymentMetadata.provider === "string" &&
      typeof paymentMetadata.currency === "string" &&
      typeof paymentMetadata.amount === "string"
        ? {
            status:
              typeof paymentMetadata.status === "string" ? paymentMetadata.status : "Pending",
            amount: paymentMetadata.amount,
            currency: paymentMetadata.currency,
            method:
              typeof paymentMetadata.method === "string" ? paymentMetadata.method : "Online",
            provider: paymentMetadata.provider,
            providerPaymentId:
              typeof paymentMetadata.providerPaymentId === "string"
                ? paymentMetadata.providerPaymentId
                : null,
          }
        : undefined,
    lockedPricing:
      detail.quotedTotalMinor != null &&
      detail.quotedCurrencyCode != null &&
      detail.quotedPricingVersion != null
        ? {
            totalMinor: String(detail.quotedTotalMinor),
            currency: String(detail.quotedCurrencyCode).trim().toUpperCase(),
            pricingRuleVersion: String(detail.quotedPricingVersion),
            listPriceMinor:
              detail.quotedListPriceMinor != null ? String(detail.quotedListPriceMinor) : null,
          }
        : null,
    createdAt: detail.createdAt.toISOString(),
    updatedAt: detail.updatedAt.toISOString(),
  };
}

export function toWaitlistResponse(entity: WaitlistItemEntity): WaitlistItemResponseDto {
  return {
    id: entity.id,
    tenantId: entity.tenantId,
    tourId: entity.tourId,
    participantFullName: entity.participantFullName,
    participantContactPhone: entity.participantContactPhone,
    transportMode: entity.transportMode,
    entryMode: entity.entryMode,
    status: entity.status,
    conversionReason: entity.conversionReason,
    cancelReason: entity.cancelReason,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}
