/**
 * Production-grade OpenAPI for Booking HTTP (named components only).
 * Mirrors @app-cloud/booking-http-contracts DTOs — no anonymous Booking schemas.
 *
 * @see docs/phase-20/p7/appendices/BOOKING_OPENAPI_CERTIFICATION.md
 */

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const jsonContent = (schemaName: string, example: unknown) => ({
  "application/json": {
    schema: ref(schemaName),
    examples: {
      default: {
        summary: schemaName,
        value: example,
      },
    },
  },
});

const errorResponse = (description: string, example: { error: string; code: string }) => ({
  description,
  content: jsonContent("BookingHttpError", example),
});

/** Shared Booking component schemas (single definition each). */
export const BOOKING_OPENAPI_SCHEMAS: Record<string, Record<string, unknown>> = {
  BookingStatus: {
    type: "string",
    enum: ["pending", "approved", "waitlisted", "rejected", "cancelled"],
    description: "Booking lifecycle status (booking-http-contracts).",
    examples: ["pending"],
  },
  BookingPaymentStatus: {
    type: "string",
    enum: ["unpaid", "partial", "paid"],
    description: "Payment projection on booking list/create (booking-http-contracts).",
    examples: ["unpaid"],
  },
  BookingsListView: {
    type: "string",
    enum: ["ops", "mine"],
    description: "List view discriminator.",
    examples: ["ops"],
  },
  BookingId: {
    type: "string",
    format: "uuid",
    description: "Booking / operator registration id.",
    examples: ["00000000-0000-4000-8000-000000000891"],
  },
  BookingTourId: {
    type: "string",
    format: "uuid",
    description: "Tour id.",
    examples: ["00000000-0000-4000-8000-000000000880"],
  },
  BookingHttpError: {
    type: "object",
    required: ["error", "code"],
    additionalProperties: true,
    properties: {
      error: { type: "string", examples: ["forbidden"] },
      code: { type: "string", examples: ["BOOKINGS_OPS_FORBIDDEN"] },
      maxBatch: { type: "integer", description: "Present on bulk approve batch limit." },
    },
    examples: [{ error: "forbidden", code: "BOOKINGS_OPS_FORBIDDEN" }],
  },
  BookingRegistrationIntake: {
    type: "object",
    description: "Opaque product intake JSON; Booking requires tourCapacityMax for capacity.",
    additionalProperties: true,
    properties: {
      tourCapacityMax: { type: "integer", minimum: 1, examples: [10] },
    },
    examples: [{ tourCapacityMax: 10 }],
  },
  BookingListItem: {
    type: "object",
    description: "List/detail projection (DTO BookingListItem). No dedicated GET-by-id route.",
    required: [
      "id",
      "tourId",
      "tourTitle",
      "guestLabel",
      "partySize",
      "status",
      "paymentStatus",
      "departureAt",
      "submittedAt",
    ],
    properties: {
      id: ref("BookingId"),
      tourId: ref("BookingTourId"),
      tourTitle: { type: "string", examples: ["Alborz Day Hike"] },
      guestLabel: { type: "string", examples: ["Ada Lovelace"] },
      partySize: { type: "integer", minimum: 1, examples: [2] },
      status: ref("BookingStatus"),
      paymentStatus: ref("BookingPaymentStatus"),
      departureAt: { type: "string", format: "date-time", examples: ["2031-08-01T10:00:00.000Z"] },
      submittedAt: { type: "string", format: "date-time", examples: ["2026-07-20T08:00:00.000Z"] },
      registrationIntake: ref("BookingRegistrationIntake"),
      rejectReason: {
        type: "string",
        description: "Ops reject reason when status=rejected (optional / additive).",
        examples: ["capacity"],
      },
    },
    examples: [
      {
        id: "00000000-0000-4000-8000-000000000891",
        tourId: "00000000-0000-4000-8000-000000000880",
        tourTitle: "Alborz Day Hike",
        guestLabel: "Ada Lovelace",
        partySize: 2,
        status: "pending",
        paymentStatus: "unpaid",
        departureAt: "2031-08-01T10:00:00.000Z",
        submittedAt: "2026-07-20T08:00:00.000Z",
        registrationIntake: { tourCapacityMax: 10 },
      },
    ],
  },
  BookingsListResponse: {
    type: "object",
    required: ["items", "total", "nextCursor"],
    properties: {
      items: { type: "array", items: ref("BookingListItem") },
      total: { type: "integer", minimum: 0, examples: [1] },
      nextCursor: { type: ["string", "null"], examples: [null] },
    },
    examples: [
      {
        items: [
          {
            id: "00000000-0000-4000-8000-000000000891",
            tourId: "00000000-0000-4000-8000-000000000880",
            tourTitle: "Alborz Day Hike",
            guestLabel: "Ada Lovelace",
            partySize: 2,
            status: "pending",
            paymentStatus: "unpaid",
            departureAt: "2031-08-01T10:00:00.000Z",
            submittedAt: "2026-07-20T08:00:00.000Z",
          },
        ],
        total: 1,
        nextCursor: null,
      },
    ],
  },
  BookingTourChip: {
    type: "object",
    required: ["tourId", "tourTitle", "pendingCount", "totalCount"],
    properties: {
      tourId: ref("BookingTourId"),
      tourTitle: { type: "string", examples: ["Alborz Day Hike"] },
      pendingCount: { type: "integer", minimum: 0, examples: [3] },
      totalCount: { type: "integer", minimum: 0, examples: [12] },
    },
    examples: [
      {
        tourId: "00000000-0000-4000-8000-000000000880",
        tourTitle: "Alborz Day Hike",
        pendingCount: 3,
        totalCount: 12,
      },
    ],
  },
  BookingsSummaryResponse: {
    type: "object",
    required: ["pending", "approvedToday", "departures7d", "waitlist", "tourChips"],
    properties: {
      pending: { type: "integer", minimum: 0, examples: [4] },
      approvedToday: { type: "integer", minimum: 0, examples: [2] },
      departures7d: { type: "integer", minimum: 0, examples: [5] },
      waitlist: { type: "integer", minimum: 0, examples: [1] },
      tourChips: { type: "array", items: ref("BookingTourChip") },
    },
    examples: [
      {
        pending: 4,
        approvedToday: 2,
        departures7d: 5,
        waitlist: 1,
        tourChips: [
          {
            tourId: "00000000-0000-4000-8000-000000000880",
            tourTitle: "Alborz Day Hike",
            pendingCount: 3,
            totalCount: 12,
          },
        ],
      },
    ],
  },
  CreateBookingRequest: {
    type: "object",
    required: ["tourId", "tourTitle", "guestLabel", "partySize", "departureAt"],
    properties: {
      tourId: ref("BookingTourId"),
      tourTitle: { type: "string", minLength: 1, examples: ["Alborz Day Hike"] },
      guestLabel: { type: "string", minLength: 1, examples: ["Ada Lovelace"] },
      guestEmail: { type: "string", format: "email", examples: ["ada@example.com"] },
      guestPhone: { type: "string", examples: ["+15550001111"] },
      partySize: { type: "integer", minimum: 1, examples: [2] },
      departureAt: { type: "string", format: "date-time", examples: ["2031-08-01T10:00:00.000Z"] },
      paymentStatus: ref("BookingPaymentStatus"),
      registrationIntake: ref("BookingRegistrationIntake"),
    },
    examples: [
      {
        tourId: "00000000-0000-4000-8000-000000000880",
        tourTitle: "Alborz Day Hike",
        guestLabel: "Ada Lovelace",
        guestEmail: "ada@example.com",
        partySize: 2,
        departureAt: "2031-08-01T10:00:00.000Z",
        paymentStatus: "unpaid",
        registrationIntake: { tourCapacityMax: 10 },
      },
    ],
  },
  CreateBookingResponse: {
    type: "object",
    required: ["id", "status"],
    properties: {
      id: ref("BookingId"),
      status: ref("BookingStatus"),
    },
    examples: [{ id: "00000000-0000-4000-8000-000000000891", status: "pending" }],
  },
  ApproveBookingResponse: {
    type: "object",
    required: ["id", "status", "approvedAt"],
    properties: {
      id: ref("BookingId"),
      status: ref("BookingStatus"),
      approvedAt: { type: "string", format: "date-time", examples: ["2026-07-20T12:00:00.000Z"] },
    },
    examples: [
      {
        id: "00000000-0000-4000-8000-000000000891",
        status: "approved",
        approvedAt: "2026-07-20T12:00:00.000Z",
      },
    ],
  },
  RejectBookingRequest: {
    type: "object",
    properties: {
      reason: {
        type: "string",
        description: "Optional ops reject reason; persisted as rejectReason when non-empty.",
        examples: ["capacity"],
      },
    },
    examples: [{ reason: "capacity" }],
  },
  RejectBookingResponse: {
    type: "object",
    required: ["id", "status"],
    properties: {
      id: ref("BookingId"),
      status: ref("BookingStatus"),
      rejectReason: {
        type: "string",
        description: "Persisted reject reason when provided (additive / optional).",
        examples: ["capacity"],
      },
    },
    examples: [
      {
        id: "00000000-0000-4000-8000-000000000891",
        status: "rejected",
        rejectReason: "capacity",
      },
    ],
  },
  WaitlistBookingResponse: {
    type: "object",
    required: ["id", "status"],
    properties: {
      id: ref("BookingId"),
      status: ref("BookingStatus"),
    },
    examples: [{ id: "00000000-0000-4000-8000-000000000891", status: "waitlisted" }],
  },
  CancelBookingResponse: {
    type: "object",
    required: ["id", "status"],
    properties: {
      id: ref("BookingId"),
      status: ref("BookingStatus"),
    },
    examples: [{ id: "00000000-0000-4000-8000-000000000891", status: "cancelled" }],
  },
  BulkApproveBookingsRequest: {
    type: "object",
    required: ["ids"],
    properties: {
      ids: {
        type: "array",
        items: ref("BookingId"),
        minItems: 1,
        examples: [["00000000-0000-4000-8000-000000000891"]],
      },
    },
    examples: [{ ids: ["00000000-0000-4000-8000-000000000891"] }],
  },
  BulkApproveBookingsResponse: {
    type: "object",
    required: ["approvedIds", "skippedIds"],
    properties: {
      approvedIds: { type: "array", items: ref("BookingId") },
      skippedIds: { type: "array", items: ref("BookingId") },
    },
    examples: [
      {
        approvedIds: ["00000000-0000-4000-8000-000000000891"],
        skippedIds: [],
      },
    ],
  },
  BookingMemberReceiptJsonBody: {
    type: "object",
    required: ["fileKey"],
    properties: {
      fileKey: {
        type: "string",
        minLength: 1,
        examples: ["tenants/00000000-0000-4000-8000-000000000014/receipts/proof.bin"],
      },
      note: { type: "string", examples: ["bank transfer"] },
    },
    examples: [
      {
        fileKey: "tenants/00000000-0000-4000-8000-000000000014/receipts/proof.bin",
        note: "bank transfer",
      },
    ],
  },
  BookingMemberReceiptStatusResponse: {
    type: "object",
    required: ["status"],
    description: "Finance member receipt status for a booking registration.",
    properties: {
      status: {
        type: "string",
        enum: ["none", "pending", "rejected", "paid"],
        examples: ["pending"],
      },
    },
    examples: [{ status: "pending" }],
  },
  BookingListSearchQuery: {
    type: "string",
    description: "Free-text guest/tour search.",
    examples: ["Ada"],
  },
  BookingListCursor: {
    type: "string",
    description: "Opaque pagination cursor.",
    examples: ["opaque-cursor"],
  },
  BookingListLimit: {
    type: "integer",
    minimum: 1,
    maximum: 100,
    default: 25,
    description: "Page size.",
    examples: [25],
  },
  BookingReceiptCreatedResponse: {
    type: "object",
    description: "Finance receipt row returned after POST /bookings/{bookingId}/receipts.",
    additionalProperties: true,
    properties: {
      id: { type: "string", format: "uuid", examples: ["00000000-0000-4000-8000-000000000701"] },
      paymentId: { type: "string", format: "uuid", examples: ["00000000-0000-4000-8000-000000000702"] },
      status: { type: "string", examples: ["Pending"] },
      fileKey: { type: "string", examples: ["tenants/…/receipts/proof.bin"] },
    },
    examples: [
      {
        id: "00000000-0000-4000-8000-000000000701",
        paymentId: "00000000-0000-4000-8000-000000000702",
        status: "Pending",
        fileKey: "tenants/00000000-0000-4000-8000-000000000014/receipts/proof.bin",
      },
    ],
  },
  BookingReceiptBinaryBody: {
    type: "string",
    format: "binary",
    description: "Raw receipt upload body (Content-Type not application/json).",
    examples: ["<binary>"],
  },
};

const bookingIdPathParam = {
  name: "bookingId",
  in: "path",
  required: true,
  schema: ref("BookingId"),
  examples: {
    default: {
      summary: "BookingId",
      value: "00000000-0000-4000-8000-000000000891",
    },
  },
};

const authErrorResponses = {
  401: errorResponse("Unauthorized", { error: "unauthorized", code: "UNAUTHORIZED" }),
  403: errorResponse("Forbidden (ops / ownership)", {
    error: "forbidden",
    code: "BOOKINGS_OPS_FORBIDDEN",
  }),
};

const capacityConflictResponses = {
  409: errorResponse("Capacity rejected (BOOKING_CAPACITY_REJECTED)", {
    error: "BOOKING_CAPACITY_REJECTED: tourCapacityMax required",
    code: "BOOKING_CAPACITY_REJECTED",
  }),
};

const notFoundConflictResponses = {
  404: errorResponse("Not found", { error: "not_found", code: "BOOKING_NOT_FOUND" }),
  409: errorResponse("Status conflict", {
    error: "conflict",
    code: "BOOKING_STATUS_CONFLICT",
  }),
};

/** Per-operationId overrides — all schemas via $ref. */
export const BOOKING_OPENAPI_OVERRIDES: Record<string, Record<string, unknown>> = {
  listBookings: {
    tags: ["Bookings"],
    parameters: [
      {
        name: "view",
        in: "query",
        required: false,
        schema: ref("BookingsListView"),
        examples: { default: { value: "ops" } },
      },
      {
        name: "status",
        in: "query",
        required: false,
        schema: ref("BookingStatus"),
        examples: { default: { value: "pending" } },
      },
      {
        name: "tourId",
        in: "query",
        required: false,
        schema: ref("BookingTourId"),
        examples: { default: { value: "00000000-0000-4000-8000-000000000880" } },
      },
      {
        name: "paymentStatus",
        in: "query",
        required: false,
        description: "Filter by booking payment status (payment status surface).",
        schema: ref("BookingPaymentStatus"),
        examples: { default: { value: "unpaid" } },
      },
      {
        name: "q",
        in: "query",
        required: false,
        schema: ref("BookingListSearchQuery"),
        examples: { default: { value: "Ada" } },
      },
      {
        name: "cursor",
        in: "query",
        required: false,
        schema: ref("BookingListCursor"),
        examples: { default: { value: "opaque-cursor" } },
      },
      {
        name: "limit",
        in: "query",
        required: false,
        schema: ref("BookingListLimit"),
        examples: { default: { value: 25 } },
      },
    ],
    responses: {
      200: {
        description: "Bookings list page",
        content: jsonContent("BookingsListResponse", {
          items: [
            {
              id: "00000000-0000-4000-8000-000000000891",
              tourId: "00000000-0000-4000-8000-000000000880",
              tourTitle: "Alborz Day Hike",
              guestLabel: "Ada Lovelace",
              partySize: 2,
              status: "pending",
              paymentStatus: "unpaid",
              departureAt: "2031-08-01T10:00:00.000Z",
              submittedAt: "2026-07-20T08:00:00.000Z",
            },
          ],
          total: 1,
          nextCursor: null,
        }),
      },
      ...authErrorResponses,
    },
  },
  createBooking: {
    tags: ["Bookings"],
    requestBody: {
      required: true,
      content: jsonContent("CreateBookingRequest", {
        tourId: "00000000-0000-4000-8000-000000000880",
        tourTitle: "Alborz Day Hike",
        guestLabel: "Ada Lovelace",
        guestEmail: "ada@example.com",
        partySize: 2,
        departureAt: "2031-08-01T10:00:00.000Z",
        paymentStatus: "unpaid",
        registrationIntake: { tourCapacityMax: 10 },
      }),
    },
    responses: {
      201: {
        description: "Booking created",
        content: jsonContent("CreateBookingResponse", {
          id: "00000000-0000-4000-8000-000000000891",
          status: "pending",
        }),
      },
      400: errorResponse("Invalid body", {
        error: "invalid_body",
        code: "BOOKING_CREATE_INVALID",
      }),
      ...authErrorResponses,
      ...capacityConflictResponses,
      404: errorResponse("Unsupported workspace", {
        error: "BOOKING_WORKSPACE_UNSUPPORTED",
        code: "BOOKING_WORKSPACE_UNSUPPORTED",
      }),
    },
  },
  getBookingsSummary: {
    tags: ["Bookings"],
    responses: {
      200: {
        description: "Ops summary",
        content: jsonContent("BookingsSummaryResponse", {
          pending: 4,
          approvedToday: 2,
          departures7d: 5,
          waitlist: 1,
          tourChips: [
            {
              tourId: "00000000-0000-4000-8000-000000000880",
              tourTitle: "Alborz Day Hike",
              pendingCount: 3,
              totalCount: 12,
            },
          ],
        }),
      },
      ...authErrorResponses,
    },
  },
  bulkApproveBookings: {
    tags: ["Bookings"],
    requestBody: {
      required: true,
      content: jsonContent("BulkApproveBookingsRequest", {
        ids: ["00000000-0000-4000-8000-000000000891"],
      }),
    },
    responses: {
      200: {
        description: "Bulk approve result",
        content: jsonContent("BulkApproveBookingsResponse", {
          approvedIds: ["00000000-0000-4000-8000-000000000891"],
          skippedIds: [],
        }),
      },
      400: errorResponse("Batch limit", {
        error: "batch_limit",
        code: "BULK_APPROVE_BATCH_LIMIT",
      }),
      ...authErrorResponses,
      ...capacityConflictResponses,
    },
  },
  approveBooking: {
    tags: ["Bookings"],
    parameters: [bookingIdPathParam],
    responses: {
      200: {
        description: "Approved (emits registration.approved)",
        content: jsonContent("ApproveBookingResponse", {
          id: "00000000-0000-4000-8000-000000000891",
          status: "approved",
          approvedAt: "2026-07-20T12:00:00.000Z",
        }),
      },
      ...authErrorResponses,
      ...notFoundConflictResponses,
      ...capacityConflictResponses,
    },
  },
  rejectBooking: {
    tags: ["Bookings"],
    parameters: [bookingIdPathParam],
    requestBody: {
      required: false,
      content: jsonContent("RejectBookingRequest", { reason: "capacity" }),
    },
    responses: {
      200: {
        description: "Rejected (intentionally silent — no outbox)",
        content: jsonContent("RejectBookingResponse", {
          id: "00000000-0000-4000-8000-000000000891",
          status: "rejected",
        }),
      },
      ...authErrorResponses,
      ...notFoundConflictResponses,
    },
  },
  waitlistBooking: {
    tags: ["Bookings"],
    parameters: [bookingIdPathParam],
    responses: {
      200: {
        description: "Waitlisted (emits registration.waitlisted)",
        content: jsonContent("WaitlistBookingResponse", {
          id: "00000000-0000-4000-8000-000000000891",
          status: "waitlisted",
        }),
      },
      ...authErrorResponses,
      ...notFoundConflictResponses,
    },
  },
  cancelBooking: {
    tags: ["Bookings"],
    parameters: [bookingIdPathParam],
    responses: {
      200: {
        description: "Cancelled (emits registration.cancelled)",
        content: jsonContent("CancelBookingResponse", {
          id: "00000000-0000-4000-8000-000000000891",
          status: "cancelled",
        }),
      },
      ...authErrorResponses,
      ...notFoundConflictResponses,
    },
  },
  postBookingReceipt: {
    tags: ["Bookings"],
    parameters: [bookingIdPathParam],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: ref("BookingMemberReceiptJsonBody"),
          examples: {
            default: {
              summary: "BookingMemberReceiptJsonBody",
              value: {
                fileKey: "tenants/00000000-0000-4000-8000-000000000014/receipts/proof.bin",
                note: "bank transfer",
              },
            },
          },
        },
        "application/octet-stream": {
          schema: ref("BookingReceiptBinaryBody"),
          examples: {
            default: {
              summary: "BookingReceiptBinaryBody",
              value: "<binary>",
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: "Receipt submitted",
        content: jsonContent("BookingReceiptCreatedResponse", {
          id: "00000000-0000-4000-8000-000000000701",
          paymentId: "00000000-0000-4000-8000-000000000702",
          status: "Pending",
          fileKey: "tenants/00000000-0000-4000-8000-000000000014/receipts/proof.bin",
        }),
      },
      400: errorResponse("Invalid receipt payload", {
        error: "invalid_payload",
        code: "FILE_KEY_REQUIRED",
      }),
      ...authErrorResponses,
      503: errorResponse("Object storage unavailable", {
        error: "service_unavailable",
        code: "MINIO_NOT_CONFIGURED",
      }),
    },
  },
  getBookingReceiptStatus: {
    tags: ["Bookings"],
    parameters: [bookingIdPathParam],
    responses: {
      200: {
        description: "Member receipt / payment progress for booking",
        content: jsonContent("BookingMemberReceiptStatusResponse", { status: "pending" }),
      },
      ...authErrorResponses,
    },
  },
};

/** OperationIds that must be fully schema-covered. */
export const BOOKING_OPENAPI_OPERATION_IDS = Object.keys(BOOKING_OPENAPI_OVERRIDES) as readonly string[];
