/**
 * List projection OpenAPI — paginated list responses without internal JSON blobs.
 * @see docs/dev/list-projection-guards.mdoc
 */

/** Banned on list/summary HTTP response schemas (detail endpoints may differ). */
export const FORBIDDEN_LIST_JSON_BLOB_FIELDS = [
  "registrationIntake",
  "registration_intake",
  "canonical",
  "data",
] as const;

const bookingStatusEnum = ["pending", "approved", "waitlisted", "rejected", "cancelled"] as const;
const bookingPaymentStatusEnum = ["unpaid", "partial", "paid"] as const;

export const LIST_PROJECTION_OPENAPI_COMPONENTS = {
  schemas: {
    BookingListItem: {
      type: "object",
      additionalProperties: false,
      required: [
        "id",
        "tourId",
        "tourTitle",
        "guestLabel",
        "registrantTarget",
        "transportKind",
        "personalCarOccupants",
        "partySize",
        "status",
        "paymentStatus",
        "departureAt",
        "submittedAt",
      ],
      properties: {
        id: { type: "string", format: "uuid" },
        tourId: { type: "string", format: "uuid" },
        tourTitle: { type: "string" },
        guestLabel: { type: "string" },
        guestEmail: { type: "string" },
        guestPhone: { type: "string" },
        registrantTarget: { type: "string", enum: ["self", "other"] },
        transportKind: {
          type: "string",
          nullable: true,
          enum: ["primary", "personal_car", "no_car_dong", "no_car_acquaintance"],
        },
        personalCarOccupants: {
          type: "integer",
          nullable: true,
          enum: [1, 2, 3],
        },
        partySize: { type: "integer", minimum: 1 },
        status: { type: "string", enum: [...bookingStatusEnum] },
        paymentStatus: { type: "string", enum: [...bookingPaymentStatusEnum] },
        financialDisplayState: { type: "string", enum: ["WAIVED"] },
        departureAt: { type: "string", format: "date-time" },
        submittedAt: { type: "string", format: "date-time" },
        approvedAt: { type: "string", format: "date-time" },
        rejectReason: { type: "string" },
        capacitySnapshot: {
          type: "object",
          additionalProperties: false,
          required: ["occupied", "max"],
          properties: {
            occupied: { type: "integer", minimum: 0 },
            max: { type: ["integer", "null"], minimum: 1 },
          },
        },
      },
    },
    BookingsListResponse: {
      type: "object",
      additionalProperties: false,
      required: ["items", "total", "nextCursor"],
      properties: {
        items: {
          type: "array",
          items: { $ref: "#/components/schemas/BookingListItem" },
        },
        total: { type: "integer", minimum: 0 },
        nextCursor: { type: ["string", "null"] },
      },
    },
    BookingTourChip: {
      type: "object",
      additionalProperties: false,
      required: ["tourId", "tourTitle", "pendingCount", "totalCount"],
      properties: {
        tourId: { type: "string", format: "uuid" },
        tourTitle: { type: "string" },
        pendingCount: { type: "integer", minimum: 0 },
        totalCount: { type: "integer", minimum: 0 },
      },
    },
    BookingsSummaryResponse: {
      type: "object",
      additionalProperties: false,
      required: ["pending", "approvedToday", "departures7d", "waitlist", "tourChips"],
      properties: {
        pending: { type: "integer", minimum: 0 },
        approvedToday: { type: "integer", minimum: 0 },
        departures7d: { type: "integer", minimum: 0 },
        waitlist: { type: "integer", minimum: 0 },
        tourChips: {
          type: "array",
          description:
            "Tour chips; default ops-scoped (pending>0 or departureAt>=now). Pass tourChipScope=all for history (BOOKINGS-OPS-UX P4c).",
          items: { $ref: "#/components/schemas/BookingTourChip" },
        },
      },
    },
    TourSlimListItem: {
      type: "object",
      additionalProperties: false,
      required: ["id", "tenantId", "createdAt", "rowVersion"],
      properties: {
        id: { type: "string", format: "uuid" },
        tenantId: { type: "string", format: "uuid" },
        createdAt: { type: "string", format: "date-time" },
        rowVersion: { type: "integer", minimum: 0 },
      },
    },
    TourListProjection: {
      type: "object",
      additionalProperties: false,
      required: [
        "id",
        "tenantId",
        "createdAt",
        "updatedAt",
        "rowVersion",
        "title",
        "shortDescription",
        "listStatus",
        "uiStatus",
        "priceAmount",
        "priceCurrency",
        "totalCapacity",
        "acceptedCount",
        "category",
        "coverImageUrl",
        "coverImageStorageKey",
        "departureAt",
      ],
      properties: {
        id: { type: "string", format: "uuid" },
        tenantId: { type: "string", format: "uuid" },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
        rowVersion: { type: "integer", minimum: 0 },
        title: { type: "string" },
        shortDescription: { type: ["string", "null"] },
        listStatus: {
          type: "string",
          enum: ["draft", "open", "published", "closed", "cancelled", "archived"],
        },
        uiStatus: { type: "string", enum: ["draft", "active", "archived"] },
        priceAmount: { type: ["number", "null"] },
        priceCurrency: { type: ["string", "null"] },
        totalCapacity: { type: ["integer", "null"] },
        acceptedCount: { type: "integer", minimum: 0 },
        category: { type: ["string", "null"] },
        coverImageUrl: { type: ["string", "null"] },
        coverImageStorageKey: { type: ["string", "null"] },
        departureAt: { type: ["string", "null"], format: "date-time" },
      },
    },
    ToursListResponse: {
      type: "object",
      additionalProperties: false,
      required: ["items", "nextCursor"],
      properties: {
        items: {
          type: "array",
          items: {
            oneOf: [
              { $ref: "#/components/schemas/TourSlimListItem" },
              { $ref: "#/components/schemas/TourListProjection" },
            ],
          },
        },
        nextCursor: { type: ["string", "null"] },
        total: { type: "integer", minimum: 0 },
      },
    },
  },
} as const;

const jsonResponse = (schemaRef: string) => ({
  description: "Success",
  content: {
    "application/json": {
      schema: { $ref: schemaRef },
    },
  },
});

export const LIST_PROJECTION_OPENAPI_OVERRIDES: Record<string, Record<string, unknown>> = {
  listBookings: {
    summary: "List operator bookings (keyset pagination, projected fields only)",
    responses: {
      200: jsonResponse("#/components/schemas/BookingsListResponse"),
      403: { description: "BOOKINGS_OPS_FORBIDDEN when view=ops and actor is member" },
    },
  },
  getBookingsSummary: {
    summary: "Bookings command-center KPI summary",
    responses: {
      200: jsonResponse("#/components/schemas/BookingsSummaryResponse"),
      403: { description: "BOOKINGS_OPS_FORBIDDEN for non-admin actors" },
    },
  },
  listTours: {
    summary: "List tours for tenant (cursor pagination; no canonical blob on list path)",
    responses: {
      200: jsonResponse("#/components/schemas/ToursListResponse"),
    },
  },
};
