

import type { RegistrationPaymentIntentSnapshot } from "../registration-payment-intent.types";
import { RegistrationPaymentStatus, RegistrationStatus } from "../registration-status";
import type { RegistrationWriteRecord } from "../registration-write.types";
import { WaitlistItemStatus } from "../waitlist-status";
import type { IRegistrationPaymentPort, TourBookingLockRecord } from "../../ports/registration-payment.port";

export const REGISTRATIONS_APPLICATION_PORT = Symbol("REGISTRATIONS_APPLICATION_PORT");

export type CreateRegistrationCommand = {
  tourId: string;
  bookingTarget?: string;
  participantFullName: string;
  participantContactPhone: string;
  participantNationalId?: string;
  transportMode: string;
  entryMode: string;
  telegramUserId?: string;
  telegramUsername?: string;
  vehicleSeatCapacity?: number;
  participantNote?: string;
  participantMetadata?: Record<string, unknown>;
  discountCode?: string | null;
};

export type CreateWaitlistItemCommand = {
  tourId: string;
  participantFullName: string;
  participantContactPhone: string;
  transportMode: string;
  entryMode: string;
};

export type ConvertWaitlistItemCommand = {
  conversionReason?: string;
};

export type CancelWaitlistItemCommand = {
  reason?: string;
};

export type UpdateRegistrationStatusCommand = {
  targetStatus: RegistrationStatus;
  expected_row_version: number;
};

export type UpdateRegistrationPaymentCommand = {
  paymentStatus: RegistrationPaymentStatus;
  paidAmount?: string;
  expected_row_version: number;
};

export type LockedBookingPricing = {
  totalMinor: string;
  currency: string;
  pricingRuleVersion: string;
  listPriceMinor?: string | null;
};

export type RegistrationResponse = {
  id: string;
  tenantId: string;
  tourId: string;
  participantFullName: string;
  participantContactPhone: string;
  transportMode: string;
  entryMode: string;
  bookingTarget?: string;
  participantNationalId?: string;
  telegramUserId?: string;
  telegramUsername?: string;
  vehicleSeatCapacity?: number;
  participantNote?: string;
  participantMetadata?: Record<string, unknown> | null;
  status: RegistrationStatus;
  rowVersion: number;
  paymentStatus: RegistrationPaymentStatus;
  paidAmount?: string;
  payment?: {
    status: string;
    amount: string;
    currency: string;
    method: string;
    provider: string;
    providerPaymentId: string | null;
  };
  lockedPricing?: LockedBookingPricing | null;
  createdAt: string;
  updatedAt: string;
};

export type WaitlistItemResponse = {
  id: string;
  tenantId: string;
  tourId: string;
  participantFullName: string;
  participantContactPhone: string;
  transportMode: string;
  entryMode: string;
  status: WaitlistItemStatus;
  conversionReason?: string;
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
};

/** Application orchestration surface implemented by the TypeORM adapter in `repositories/`. */
export interface RegistrationsApplicationPort extends IRegistrationPaymentPort {
  getTenantIdForTourOrThrow(tourId: string): Promise<string>;
  createRegistration(command: CreateRegistrationCommand): Promise<RegistrationResponse>;
  resolveAuthenticatedBookingInput(tourId: string): Promise<{
    tourId: string;
    participantFullName: string;
    participantContactPhone: string;
    transportMode: string;
    entryMode: string;
    telegramUserId?: string;
    telegramUsername?: string;
  }>;
  createBooking(tourId: string): Promise<RegistrationResponse>;
  listRegistrationsForTour(tourId: string): Promise<RegistrationResponse[]>;
  listLeaderRegistrationIndex(limit?: number): Promise<{
    rows: Array<RegistrationResponse & { tourTitle: string }>;
    partial: boolean;
  }>;
  getLeaderRegistrationStats(): Promise<{
    pending_count: number;
    total_count: number;
  }>;
  listWaitlistItemsForTour(tourId: string): Promise<WaitlistItemResponse[]>;
  listBookings(): Promise<RegistrationResponse[]>;
  getRegistrationById(registrationId: string): Promise<RegistrationResponse>;
  updateRegistrationStatus(
    registrationId: string,
    command: UpdateRegistrationStatusCommand
  ): Promise<RegistrationResponse>;

  updatePaymentStatus(
    id: string,
    newPaymentStatus: RegistrationPaymentStatus,
    metadata?: Record<string, unknown>
  ): Promise<RegistrationWriteRecord>;
  createWaitlistItem(command: CreateWaitlistItemCommand): Promise<WaitlistItemResponse>;
  convertWaitlistItem(
	waitlistItemId: string,
	command: ConvertWaitlistItemCommand
  ): Promise<WaitlistItemResponse>;
  cancelWaitlistItem(
    waitlistItemId: string,
    command: CancelWaitlistItemCommand
  ): Promise<WaitlistItemResponse>;
  promoteNextWaitlistSlotIfEligible(
    tenantId: string,
    tourId: string,
    lockedTour: TourBookingLockRecord
  ): Promise<boolean>;
  getPublicFlowMetrics(): {
    registrationCreatedTotal: number;
    registrationWaitlistedTotal: number;
    registrationPaidTotal: number;
  };
  createPublicRegistrationOrWaitlist(input: {
    tourId: string;
    bookingTarget?: string;
    participantFullName: string;
    participantContactPhone: string;
    participantNationalId?: string;
    transportMode: string;
    entryMode: string;
    telegramUserId?: string;
    telegramUsername?: string;
    isDriver?: boolean;
    plateNumber?: string;
    shareFuelCost?: boolean;
    vehicleSeatCapacity?: number;
    participantNote?: string;
    participantMetadata?: Record<string, unknown>;
    selectedServiceIds?: string[];
    discountCode?: string | null;
    createPaymentIntent?: (
      _registration: RegistrationWriteRecord
    ) => Promise<RegistrationPaymentIntentSnapshot>;
  }): Promise<
    | {
        type: "registration";
        registration: RegistrationResponse;
        requiresPayment: boolean;
        paymentIntent: RegistrationPaymentIntentSnapshot | null;
      }
    | { type: "waitlist"; waitlistItem: WaitlistItemResponse; queuePosition: number }
  >;
}

