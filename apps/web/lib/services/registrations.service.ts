import type {
  BookingDto,
  RegistrationParticipantMetadataDto,
  RegistrationPaymentStatus,
  RegistrationStatus,
  WaitlistItemResponseDto,
} from "@repo/types";

import { bffBrowserClient } from "@/lib/api/bff-browser-client";
import { BFF } from "@/lib/api-paths";
import { isTourOpsApiConfigured } from "../tour-ops-api-origin";
import type { PaymentIntentResponse } from "./payments.service";
import { coercePaymentIntentResponse } from "./payments.service";

export function registrationsUseLiveApi(): boolean {
  return isTourOpsApiConfigured();
}

function pickStr(o: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

function pickNum(o: Record<string, unknown>, key: string): number | null {
  const v = o[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function normalizeParticipantMetadata(raw: unknown): RegistrationParticipantMetadataDto | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const meta = raw as Record<string, unknown>;
  const intakeRaw = meta.transportIntake;
  let transportIntake: RegistrationParticipantMetadataDto["transportIntake"];
  if (intakeRaw != null && typeof intakeRaw === "object" && !Array.isArray(intakeRaw)) {
    const intake = intakeRaw as Record<string, unknown>;
    transportIntake = {
      ...(typeof intake.isDriver === "boolean" ? { isDriver: intake.isDriver } : {}),
      ...(typeof intake.plateNumber === "string" ? { plateNumber: intake.plateNumber } : {}),
      ...(typeof intake.shareFuelCost === "boolean" ? { shareFuelCost: intake.shareFuelCost } : {}),
    };
  }
  const peaks = meta.userPastPeaksCount;
  const userPastPeaksCount =
    typeof peaks === "number" && Number.isInteger(peaks) ? peaks : undefined;
  if (transportIntake == null && userPastPeaksCount === undefined) {
    return null;
  }
  return {
    ...(userPastPeaksCount !== undefined ? { userPastPeaksCount } : {}),
    ...(transportIntake != null ? { transportIntake } : {}),
  };
}

function pickLockedPricing(
  o: Record<string, unknown>,
): BookingDto["lockedPricing"] {
  const raw = o.lockedPricing ?? o.locked_pricing;
  if (raw == null || typeof raw !== "object") return null;
  const lp = raw as Record<string, unknown>;
  const totalMinor = pickStr(lp, "totalMinor", "total_minor");
  const currency = pickStr(lp, "currency");
  const pricingRuleVersion = pickStr(lp, "pricingRuleVersion", "pricing_rule_version");
  if (!totalMinor || !currency || !pricingRuleVersion) return null;
  const listRaw = lp.listPriceMinor ?? lp.list_price_minor;
  const listPriceMinor =
    listRaw === null ? null : listRaw !== undefined ? String(listRaw) : null;
  return {
    totalMinor,
    currency: currency.trim().toUpperCase(),
    pricingRuleVersion,
    listPriceMinor,
  };
}

/** Normalizes API JSON (camelCase or occasional snake_case) into `RegistrationResponseDto` shape. */
export function normalizeRegistrationPayload(raw: unknown): BookingDto {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid registration payload");
  }
  const o = raw as Record<string, unknown>;
  return {
    id: pickStr(o, "id"),
    tenantId: pickStr(o, "tenantId", "tenant_id"),
    tourId: pickStr(o, "tourId", "tour_id"),
    participantFullName: pickStr(o, "participantFullName", "participant_full_name"),
    participantContactPhone: pickStr(o, "participantContactPhone", "participant_contact_phone"),
    transportMode: pickStr(o, "transportMode", "transport_mode") as BookingDto["transportMode"],
    entryMode: pickStr(o, "entryMode", "entry_mode") as BookingDto["entryMode"],
    telegramUserId: o.telegramUserId != null ? String(o.telegramUserId) : (o.telegram_user_id as string | null | undefined),
    telegramUsername:
      o.telegramUsername != null
        ? String(o.telegramUsername)
        : ((o.telegram_username as string | null | undefined) ?? null),
    vehicleSeatCapacity: pickNum(o, "vehicleSeatCapacity") ?? pickNum(o, "vehicle_seat_capacity"),
    participantNote:
      typeof o.participantNote === "string"
        ? o.participantNote
        : typeof o.participant_note === "string"
          ? o.participant_note
          : null,
    participantMetadata: normalizeParticipantMetadata(o.participantMetadata ?? o.participant_metadata),
    status: pickStr(o, "status") as RegistrationStatus,
    rowVersion: pickNum(o, "rowVersion") ?? pickNum(o, "row_version") ?? 1,
    paymentStatus: pickStr(o, "paymentStatus", "payment_status") as RegistrationPaymentStatus,
    paidAmount: o.paidAmount != null ? String(o.paidAmount) : (o.paid_amount != null ? String(o.paid_amount) : null),
    payment:
      o.payment != null && typeof o.payment === "object"
        ? (o.payment as Record<string, unknown>)
        : null,
    lockedPricing: pickLockedPricing(o),
    createdAt: pickStr(o, "createdAt", "created_at"),
    updatedAt: pickStr(o, "updatedAt", "updated_at"),
  };
}

export type ParticipantMetadataPayload = {
  userPastPeaksCount?: number;
};

/** Body fields aligned with `CreateRegistrationDto` (no `tenantId` — tenant is derived server-side). */
export type CreateRegistrationPayload = {
  tourId: string;
  bookingTarget?: "self" | "guest";
  participantFullName: string;
  participantContactPhone: string;
  participantNationalId?: string;
  transportMode: BookingDto["transportMode"];
  entryMode: BookingDto["entryMode"];
  telegramUserId?: string | null;
  telegramUsername?: string | null;
  isDriver?: boolean;
  plateNumber?: string;
  shareFuelCost?: boolean;
  vehicleSeatCapacity?: number | null;
  participantNote?: string | null;
  participantMetadata?: ParticipantMetadataPayload;
};

export async function createRegistration(payload: CreateRegistrationPayload): Promise<BookingDto> {
  const raw = await bffBrowserClient.post<unknown>(BFF.registrations, payload, {
    idempotencyKey: true,
  });
  return normalizeRegistrationPayload(raw);
}

/** Outcome of canonical public placement (`POST /api/v2/tours/:tourId/register`). */
export type PublicRegisterOutcome =
  | {
      outcome: "registered";
      booking: BookingDto;
      /** Server may auto-create an intent when `costContext.requiresPayment` is true */
      paymentIntent: PaymentIntentResponse | null;
    }
  | { outcome: "waitlisted"; waitlistItemId: string; queuePosition: number };

/**
 * Preferred participant placement (capacity-aware). When full, the backend may return a waitlist
 * payload in the same 201 response (no `CAPACITY_FULL` error for this path).
 */
export async function publicRegisterTour(
  tourId: string,
  payload: CreateRegistrationPayload,
): Promise<PublicRegisterOutcome> {
  const raw = await bffBrowserClient.post<unknown>(
    BFF.tourRegister(tourId),
    { ...payload, tourId },
    { idempotencyKey: true },
  );
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid register response");
  }
  const o = raw as Record<string, unknown>;

  if (o.registration != null && typeof o.registration === "object") {
    const paymentRaw = o.paymentIntent ?? o.payment_intent;
    return {
      outcome: "registered",
      booking: normalizeRegistrationPayload(o.registration),
      paymentIntent: coercePaymentIntentResponse(paymentRaw),
    };
  }

  const waitlistItemId = pickStr(o, "waitlistItemId", "waitlist_item_id");
  const queuePosition =
    pickNum(o, "waitlistPosition") ?? pickNum(o, "queuePosition") ?? pickNum(o, "queue_position");

  if (waitlistItemId && queuePosition != null) {
    return { outcome: "waitlisted", waitlistItemId, queuePosition };
  }

  throw new Error("Unexpected tour register response shape");
}

/** Explicit public waitlist (`POST /api/v2/tours/:tourId/waitlist`) — e.g. capacity-available conflict if user only wants waitlist. */
export async function publicWaitlistTour(
  tourId: string,
  payload: CreateWaitlistPayload,
): Promise<{ waitlistItemId: string; queuePosition: number }> {
  return bffBrowserClient.post<{ waitlistItemId: string; queuePosition: number }>(
    BFF.tourWaitlist(tourId),
    { ...payload, tourId },
    { idempotencyKey: true },
  );
}

export type CreateWaitlistPayload = Omit<CreateRegistrationPayload, "entryMode"> & {
  entryMode: BookingDto["entryMode"];
};

export async function createWaitlistItem(payload: CreateWaitlistPayload): Promise<WaitlistItemResponseDto> {
  return bffBrowserClient.post<WaitlistItemResponseDto>(BFF.waitlistItems, payload, {
    idempotencyKey: true,
  });
}

export async function getRegistrationById(registrationId: string): Promise<BookingDto> {
  const raw = await bffBrowserClient.get<unknown>(BFF.registration(registrationId));
  return normalizeRegistrationPayload(raw);
}

export async function listRegistrationsForTour(tourId: string): Promise<BookingDto[]> {
  const raw = await bffBrowserClient.get<unknown>(BFF.tourRegistrations(tourId));
  return Array.isArray(raw) ? raw.map((row) => normalizeRegistrationPayload(row)) : [];
}

export async function listWaitlistItemsForTour(tourId: string): Promise<WaitlistItemResponseDto[]> {
  return bffBrowserClient.get<WaitlistItemResponseDto[]>(BFF.tourWaitlistItems(tourId));
}

export async function updateRegistrationStatus(
  registrationId: string,
  body: { targetStatus: RegistrationStatus; expected_row_version: number }
): Promise<BookingDto> {
  const raw = await bffBrowserClient.patch<unknown>(
    BFF.registrationStatus(registrationId),
    body,
    { idempotencyKey: true }
  );
  return normalizeRegistrationPayload(raw);
}

export async function updateRegistrationPayment(
  registrationId: string,
  body: {
    paymentStatus: RegistrationPaymentStatus;
    paidAmount?: number;
    expected_row_version: number;
  }
): Promise<BookingDto> {
  const raw = await bffBrowserClient.patch<unknown>(
    BFF.registrationPayment(registrationId),
    body,
    { idempotencyKey: true }
  );
  return normalizeRegistrationPayload(raw);
}

export async function convertWaitlistItem(
  waitlistItemId: string,
  body?: { conversionReason?: string }
): Promise<WaitlistItemResponseDto> {
  return bffBrowserClient.post<WaitlistItemResponseDto>(
    BFF.waitlistItemConvert(waitlistItemId),
    body ?? {},
    { idempotencyKey: true }
  );
}
