import { Inject, Injectable } from "@nestjs/common";

import type { RegistrationPaymentIntentSnapshot } from "../domain/registration-payment-intent.types";
import { ConvertWaitlistItemDto } from "../dto/convert-waitlist-item.dto";
import { CreateWaitlistItemDto } from "../dto/create-waitlist-item.dto";
import {
  RegistrationResponseDto,
  WaitlistItemResponseDto,
} from "../dto/get-registration.dto";
import { UpdateRegistrationStatusDto } from "../dto/update-registration-status.dto";
import { RegistrationPaymentStatus } from "../registration.entity";
import type { TourBookingLockRecord } from "../domain/registration-write.types";
import type {
  RegistrationsApplicationPort,
  CreateRegistrationCommand,
  CancelWaitlistItemCommand,
} from "../domain/ports/registrations-application.port";
import type { RegistrationWriteRecord } from "../domain/registration-write.types";
import { RegistrationStatus } from "../registration.entity";
import { RegistrationTransactionRunner } from "../services/registration-transaction.runner";
import { RegistrationTourAccessService } from "../services/registration-tour-access.service";
import { RegistrationQueryService } from "../services/registration-query.service";
import { RegistrationCreationService } from "../services/registration-creation.service";
import { RegistrationStateMachineService } from "../services/registration-state-machine.service";
import { RegistrationWaitlistService } from "../services/registration-waitlist.service";
import { RegistrationPublicFlowMetrics } from "../services/registration-public-flow-metrics";
import { asTourBookingLockRecord } from "../services/registration-response.mapper";

/**
 * Thin facade: implements {@link RegistrationsApplicationPort} by delegating to specialized services.
 * Decomposition inventory: `architecture/service-decomposition.map.ts` (`REGISTRATIONS_GOD_METHODS`).
 */
@Injectable()
export class TypeOrmRegistrationsApplicationService implements RegistrationsApplicationPort {
  constructor(
    @Inject(RegistrationTransactionRunner)
    private readonly transactionRunner: RegistrationTransactionRunner,
    @Inject(RegistrationTourAccessService)
    private readonly tourAccess: RegistrationTourAccessService,
    @Inject(RegistrationQueryService)
    private readonly queryService: RegistrationQueryService,
    @Inject(RegistrationCreationService)
    private readonly creationService: RegistrationCreationService,
    @Inject(RegistrationStateMachineService)
    private readonly stateMachineService: RegistrationStateMachineService,
    @Inject(RegistrationWaitlistService)
    private readonly waitlistService: RegistrationWaitlistService,
    @Inject(RegistrationPublicFlowMetrics)
    private readonly metrics: RegistrationPublicFlowMetrics,
  ) {}

  getTenantIdForTourOrThrow(tourId: string): Promise<string> {
    return this.tourAccess.getTenantIdForTourOrThrow(tourId);
  }

  createRegistration(command: CreateRegistrationCommand): Promise<RegistrationResponseDto> {
    return this.creationService.createRegistration(command);
  }

  resolveAuthenticatedBookingInput(tourId: string) {
    return this.queryService.resolveAuthenticatedBookingInput(tourId);
  }

  createBooking(tourId: string): Promise<RegistrationResponseDto> {
    return this.creationService.createBooking(tourId);
  }

  listRegistrationsForTour(tourId: string): Promise<RegistrationResponseDto[]> {
    return this.queryService.listRegistrationsForTour(tourId);
  }

  listLeaderRegistrationIndex(limit?: number) {
    return this.queryService.listLeaderRegistrationIndex(limit);
  }

  getLeaderRegistrationStats() {
    return this.queryService.getLeaderRegistrationStats();
  }

  listWaitlistItemsForTour(tourId: string): Promise<WaitlistItemResponseDto[]> {
    return this.queryService.listWaitlistItemsForTour(tourId);
  }

  listBookings(): Promise<RegistrationResponseDto[]> {
    return this.queryService.listBookings();
  }

  getRegistrationById(registrationId: string): Promise<RegistrationResponseDto> {
    return this.queryService.getRegistrationById(registrationId);
  }

  updateRegistrationStatus(
    registrationId: string,
    payload: UpdateRegistrationStatusDto,
  ): Promise<RegistrationResponseDto> {
    return this.stateMachineService.updateRegistrationStatus(registrationId, payload);
  }

  updatePaymentStatus(
    id: string,
    newPaymentStatus: RegistrationPaymentStatus,
    metadata?: Record<string, unknown>,
  ): Promise<RegistrationWriteRecord> {
    return this.stateMachineService.updatePaymentStatus(id, newPaymentStatus, metadata);
  }

  createWaitlistItem(createDto: CreateWaitlistItemDto): Promise<WaitlistItemResponseDto> {
    return this.waitlistService.createWaitlistItem(createDto);
  }

  convertWaitlistItem(
    waitlistItemId: string,
    payload: ConvertWaitlistItemDto,
  ): Promise<WaitlistItemResponseDto> {
    return this.waitlistService.convertWaitlistItem(waitlistItemId, payload);
  }

  cancelWaitlistItem(
    waitlistItemId: string,
    command: CancelWaitlistItemCommand,
  ): Promise<WaitlistItemResponseDto> {
    return this.waitlistService.cancelWaitlistItem(waitlistItemId, command);
  }

  async lockTourRowForUpdate(
    tourId: string,
    tenantId: string,
  ): Promise<TourBookingLockRecord> {
    const manager = this.transactionRunner.activeManager;
    const tour = await this.tourAccess.requireTourInTenantForUpdate(manager, tourId, tenantId);
    return asTourBookingLockRecord(tour);
  }

  promoteNextWaitlistSlotIfEligible(
    tenantId: string,
    tourId: string,
    lockedTour: TourBookingLockRecord,
  ): Promise<boolean> {
    return this.waitlistService.promoteNextWaitlistSlotIfEligible(tenantId, tourId, lockedTour);
  }

  promoteNextWaitlistItemForPaymentFlow(
    releasedRegistration: RegistrationWriteRecord,
    lockedTour: TourBookingLockRecord | null,
  ): Promise<boolean> {
    return this.waitlistService.promoteNextWaitlistItemForPaymentFlow(
      releasedRegistration,
      lockedTour,
    );
  }

  transitionRegistrationForPayment(
    registration: RegistrationWriteRecord,
    targetStatus: RegistrationStatus,
    actorId: string,
  ): Promise<RegistrationWriteRecord> {
    return this.stateMachineService.transitionRegistrationForPayment(
      registration,
      targetStatus,
      actorId,
    );
  }

  getPublicFlowMetrics() {
    return this.metrics.snapshot();
  }

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
      _registration: RegistrationWriteRecord,
    ) => Promise<RegistrationPaymentIntentSnapshot>;
  }) {
    return this.creationService.createPublicRegistrationOrWaitlist(input);
  }
}
