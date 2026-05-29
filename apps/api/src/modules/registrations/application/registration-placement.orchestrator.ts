import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";

import { ConfigService } from "../../../config/config.service";
import { RegistrationsService } from "../registrations.service";
import { RegistrationEntity } from "../registration.entity";
import { CreateRegistrationDto } from "../dto/create-registration.dto";
import { RegistrationResponseDto } from "../dto/get-registration.dto";
import {
  REGISTRATION_READ_PORT,
  type RegistrationReadPort,
} from "../domain/ports/registration-read.port";
import type { RegistrationPaymentIntentSnapshot } from "../domain/registration-payment-intent.types";

function assertPaymentIntentWhenRequired(
  requiresPayment: boolean,
  paymentIntent: RegistrationPaymentIntentSnapshot | null
): void {
  if (requiresPayment && paymentIntent == null) {
    throw new BadRequestException({
      error: {
        code: "BOOKING_PAYMENT_INTENT_MISSING",
        message:
          "This tour requires payment at signup, but no payment intent was created in the booking transaction."
      }
    });
  }
}

@Injectable()
export class RegistrationPlacementOrchestrator {
  constructor(
    @Inject(RegistrationsService) private readonly registrationsService: RegistrationsService,
    @Inject(REGISTRATION_READ_PORT) private readonly registrationReadPort: RegistrationReadPort,
    @Inject(ConfigService) private readonly configService: ConfigService
  ) {}

  private async createPaymentIntentForRegistration(
    manager: EntityManager,
    registration: RegistrationEntity
  ): Promise<RegistrationPaymentIntentSnapshot> {
    const totalMinorNum =
      registration.quotedTotalMinor != null
        ? Number(String(registration.quotedTotalMinor).trim())
        : NaN;
    if (
      !Number.isFinite(totalMinorNum) ||
      totalMinorNum < 1 ||
      !Number.isSafeInteger(totalMinorNum)
    ) {
      throw new BadRequestException({
        error: {
          code: "BOOKING_PAYABLE_AMOUNT_INVALID",
          message:
            "This tour requires payment at signup, but the locked booking price is missing or cannot be used for a payment intent."
        }
      });
    }
    const currency = String(registration.quotedCurrencyCode ?? "").trim().toUpperCase();
    if (!currency) {
      throw new BadRequestException({
        error: {
          code: "BOOKING_PAYABLE_AMOUNT_INVALID",
          message: "Locked booking currency is missing; cannot create payment intent."
        }
      });
    }
    return this.registrationReadPort.createPaymentIntentWithManager(manager, {
      registration: {
        id: registration.id,
        quotedTotalMinor: registration.quotedTotalMinor ?? null,
        quotedCurrencyCode: registration.quotedCurrencyCode ?? null
      },
      paymentProvider: this.configService.getDefaultPaymentProvider(),
      providerPaymentId: `mock-${registration.id}`
    });
  }

  async createAuthenticatedBooking(tourId: string): Promise<{
    registration: RegistrationResponseDto;
    paymentIntent: RegistrationPaymentIntentSnapshot | null;
  }> {
    const bookingInput = await this.registrationsService.resolveAuthenticatedBookingInput(tourId);
    const result = await this.registrationsService.createPublicRegistrationOrWaitlist({
      ...bookingInput,
      tourId,
      createPaymentIntent: async (manager, registration) =>
        this.createPaymentIntentForRegistration(manager, registration)
    });

    if (result.type === "waitlist") {
      throw new BadRequestException({
        error: {
          code: "CAPACITY_FULL",
          message: "Tour is at capacity; use the waitlist flow instead of booking."
        }
      });
    }

    assertPaymentIntentWhenRequired(result.requiresPayment, result.paymentIntent);

    return {
      registration: result.registration,
      paymentIntent: result.paymentIntent
    };
  }

  async publicRegister(input: {
    tourId: string;
    payload: CreateRegistrationDto;
  }): Promise<{
    registration: RegistrationResponseDto | null;
    paymentIntent: RegistrationPaymentIntentSnapshot | null;
    waitlistItemId: string | null;
    waitlistPosition: number | null;
  }> {
    const result = await this.registrationsService.createPublicRegistrationOrWaitlist({
      ...input.payload,
      tourId: input.tourId,
      createPaymentIntent: async (manager, registration) =>
        this.createPaymentIntentForRegistration(manager, registration)
    });

    if (result.type === "waitlist") {
      return {
        registration: null,
        paymentIntent: null,
        waitlistItemId: result.waitlistItem.id,
        waitlistPosition: result.queuePosition
      };
    }

    assertPaymentIntentWhenRequired(result.requiresPayment, result.paymentIntent);

    return {
      registration: result.registration,
      paymentIntent: result.paymentIntent,
      waitlistPosition: null,
      waitlistItemId: null
    };
  }
}
