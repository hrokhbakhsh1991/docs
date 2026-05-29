import type { EntityManager } from "typeorm";

import type { RegistrationPaymentIntentSnapshot } from "../registration-payment-intent.types";
import type { RegistrationPaymentStatus } from "../registration-status";
import type { RegistrationWriteRecord } from "../registration-write.types";
import type { CancelWaitlistItemDto } from "../../dto/cancel-waitlist-item.dto";
import type { ConvertWaitlistItemDto } from "../../dto/convert-waitlist-item.dto";
import type {
  CreateRegistrationDto,
  RegistrationBookingTargetDto,
} from "../../dto/create-registration.dto";
import type { CreateWaitlistItemDto } from "../../dto/create-waitlist-item.dto";
import type {
  RegistrationResponseDto,
  WaitlistItemResponseDto,
} from "../../dto/get-registration.dto";
import type { UpdateRegistrationPaymentDto } from "../../dto/update-registration-payment.dto";
import type { UpdateRegistrationStatusDto } from "../../dto/update-registration-status.dto";
import type { IRegistrationPaymentPort } from "../../ports/registration-payment.port";

export const REGISTRATIONS_APPLICATION_PORT = Symbol("REGISTRATIONS_APPLICATION_PORT");

/** Application orchestration surface implemented by the TypeORM adapter in `repositories/`. */
export interface RegistrationsApplicationPort extends IRegistrationPaymentPort {
  getTenantIdForTourOrThrow(tourId: string): Promise<string>;
  createRegistration(createDto: CreateRegistrationDto): Promise<RegistrationResponseDto>;
  resolveAuthenticatedBookingInput(tourId: string): Promise<{
    tourId: string;
    participantFullName: string;
    participantContactPhone: string;
    transportMode: string;
    entryMode: string;
    telegramUserId?: string;
    telegramUsername?: string;
  }>;
  createBooking(tourId: string): Promise<RegistrationResponseDto>;
  listRegistrationsForTour(tourId: string): Promise<RegistrationResponseDto[]>;
  listLeaderRegistrationIndex(limit?: number): Promise<{
    rows: Array<RegistrationResponseDto & { tourTitle: string }>;
    partial: boolean;
  }>;
  getLeaderRegistrationStats(): Promise<{
    pending_count: number;
    total_count: number;
  }>;
  listWaitlistItemsForTour(tourId: string): Promise<WaitlistItemResponseDto[]>;
  listBookings(): Promise<RegistrationResponseDto[]>;
  getRegistrationById(registrationId: string): Promise<RegistrationResponseDto>;
  updateRegistrationStatus(
    registrationId: string,
    payload: UpdateRegistrationStatusDto
  ): Promise<RegistrationResponseDto>;
  updateRegistrationPayment(
    registrationId: string,
    payload: UpdateRegistrationPaymentDto,
    idempotencyKey: string
  ): Promise<RegistrationResponseDto>;
  updatePaymentStatus(
    id: string,
    newPaymentStatus: RegistrationPaymentStatus,
    metadata?: Record<string, unknown>
  ): Promise<RegistrationWriteRecord>;
  createWaitlistItem(payload: CreateWaitlistItemDto): Promise<WaitlistItemResponseDto>;
  convertWaitlistItem(
    waitlistItemId: string,
    payload: ConvertWaitlistItemDto
  ): Promise<RegistrationResponseDto>;
  cancelWaitlistItem(
    waitlistItemId: string,
    payload: CancelWaitlistItemDto
  ): Promise<WaitlistItemResponseDto>;
  getPublicFlowMetrics(): {
    registrationCreatedTotal: number;
    registrationWaitlistedTotal: number;
    registrationPaidTotal: number;
  };
  createPublicRegistrationOrWaitlist(input: {
    tourId: string;
    bookingTarget?: RegistrationBookingTargetDto;
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
    participantMetadata?: import("../../dto/participant-metadata.dto").ParticipantMetadataDto;
    selectedServiceIds?: string[];
    discountCode?: string | null;
    createPaymentIntent?: (
      _manager: EntityManager,
      _registration: RegistrationWriteRecord
    ) => Promise<RegistrationPaymentIntentSnapshot>;
  }): Promise<
    | {
        type: "registration";
        registration: RegistrationResponseDto;
        requiresPayment: boolean;
        paymentIntent: RegistrationPaymentIntentSnapshot | null;
      }
    | { type: "waitlist"; waitlistItem: WaitlistItemResponseDto; queuePosition: number }
  >;
}
