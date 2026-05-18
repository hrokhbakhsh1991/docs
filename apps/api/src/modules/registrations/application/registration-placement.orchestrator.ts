import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { RegistrationsService } from "../registrations.service";
import { PaymentsService } from "../../payments/payments.service";
import { ConfigService } from "../../../config/config.service";
import { RegistrationEntity } from "../registration.entity";
import { CreateRegistrationDto } from "../dto/create-registration.dto";
import { PaymentResponseDto } from "../../payments/dto/payment-response.dto";
import { RegistrationResponseDto } from "../dto/get-registration.dto";

@Injectable()
export class RegistrationPlacementOrchestrator {
  constructor(
    @Inject(RegistrationsService) private readonly registrationsService: RegistrationsService,
    @Inject(PaymentsService) private readonly paymentsService: PaymentsService,
    @Inject(ConfigService) private readonly configService: ConfigService
  ) {}

  private async createPaymentIntentForRegistration(
    manager: EntityManager,
    registration: RegistrationEntity
  ): Promise<PaymentResponseDto> {
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
    return this.paymentsService.createPaymentIntentWithManager(manager, {
      registrationId: registration.id,
      amount: totalMinorNum,
      currency,
      paymentProvider: this.configService.getDefaultPaymentProvider(),
      providerPaymentId: `mock-${registration.id}`
    });
  }

  async createAuthenticatedBooking(tourId: string): Promise<{
    registration: RegistrationResponseDto;
    paymentIntent: PaymentResponseDto | null;
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

    return {
      registration: result.registration,
      paymentIntent: result.paymentIntent
    };
  }

  async publicRegister(input: {
    tourId: string;
    payload: CreateRegistrationDto;
  }): Promise<
    | {
        registration: RegistrationResponseDto | null;
        paymentIntent: PaymentResponseDto | null;
        waitlistItemId: string | null;
        waitlistPosition: number | null;
      }
  > {
    const result = await this.registrationsService.createPublicRegistrationOrWaitlist({
      ...input.payload,
      tourId: input.tourId,
      createPaymentIntent: async (manager: EntityManager, registration: RegistrationEntity) =>
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

    return {
      registration: result.registration,
      paymentIntent: result.paymentIntent,
      waitlistPosition: null,
      waitlistItemId: null
    };
  }
}
