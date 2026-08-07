/**
 * Booking OpenAPI certification — path inventory + production-grade schema completeness (100%).
 *
 * @see docs/phase-20/p7/appendices/BOOKING_OPENAPI_CERTIFICATION.md
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { DISPATCH_ROUTES } from "../openapi/dispatch-routes.ts";
import {
  BOOKING_OPENAPI_OPERATION_IDS,
  BOOKING_OPENAPI_OVERRIDES,
  BOOKING_OPENAPI_SCHEMAS,
} from "../openapi/booking-openapi.ts";

const here = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(here, "../..");

/** Registered Booking HTTP surfaces in app.ts (method + OpenAPI path shape). */
const REGISTERED_BOOKING_ROUTES: readonly {
  readonly method: "GET" | "POST";
  readonly path: string;
  readonly appMarker: string;
  readonly operationId: string;
  readonly requestSchema: string | null;
  readonly responseSchema: string;
  readonly errors: readonly string[];
  readonly exampleSurface: string;
}[] = [
  {
    method: "GET",
    path: "/bookings",
    appMarker: "handleListBookings",
    operationId: "listBookings",
    requestSchema: null,
    responseSchema: "BookingsListResponse",
    errors: ["401", "403"],
    exampleSurface: "query paymentStatus + BookingsListResponse",
  },
  {
    method: "POST",
    path: "/bookings",
    appMarker: "handleCreateBooking",
    operationId: "createBooking",
    requestSchema: "CreateBookingRequest",
    responseSchema: "CreateBookingResponse",
    errors: ["400", "401", "403", "404", "429"],
    exampleSurface: "CreateBookingRequest / CreateBookingResponse",
  },
  {
    method: "GET",
    path: "/bookings/summary",
    appMarker: "handleGetBookingsSummary",
    operationId: "getBookingsSummary",
    requestSchema: null,
    responseSchema: "BookingsSummaryResponse",
    errors: ["401", "403"],
    exampleSurface: "BookingsSummaryResponse",
  },
  {
    method: "GET",
    path: "/bookings/{bookingId}",
    appMarker: "handleGetBooking",
    operationId: "getBooking",
    requestSchema: null,
    responseSchema: "BookingDetailItem",
    errors: ["401", "403", "404"],
    exampleSurface: "BookingDetailItem registrationIntake",
  },
  {
    method: "POST",
    path: "/bookings/bulk-approve",
    appMarker: "handleBulkApproveBookings",
    operationId: "bulkApproveBookings",
    requestSchema: "BulkApproveBookingsRequest",
    responseSchema: "BulkApproveBookingsResponse",
    errors: ["400", "401", "403", "429"],
    exampleSurface: "BulkApproveBookingsRequest / BulkApproveBookingsResponse",
  },
  {
    method: "POST",
    path: "/bookings/{bookingId}/approve",
    appMarker: "handleApproveBooking",
    operationId: "approveBooking",
    requestSchema: null,
    responseSchema: "ApproveBookingResponse",
    errors: ["401", "403", "404", "409", "429"],
    exampleSurface: "path BookingId + ApproveBookingResponse",
  },
  {
    method: "POST",
    path: "/bookings/{bookingId}/reject",
    appMarker: "handleRejectBooking",
    operationId: "rejectBooking",
    requestSchema: "RejectBookingRequest",
    responseSchema: "RejectBookingResponse",
    errors: ["401", "403", "404", "409"],
    exampleSurface: "RejectBookingRequest / RejectBookingResponse",
  },
  {
    method: "POST",
    path: "/bookings/{bookingId}/waitlist",
    appMarker: "handleWaitlistBooking",
    operationId: "waitlistBooking",
    requestSchema: null,
    responseSchema: "WaitlistBookingResponse",
    errors: ["401", "403", "404", "409"],
    exampleSurface: "WaitlistBookingResponse",
  },
  {
    method: "POST",
    path: "/bookings/{bookingId}/cancel",
    appMarker: "handleCancelBooking",
    operationId: "cancelBooking",
    requestSchema: null,
    responseSchema: "CancelBookingResponse",
    errors: ["401", "403", "404", "409"],
    exampleSurface: "CancelBookingResponse",
  },
  {
    method: "POST",
    path: "/bookings/{bookingId}/receipts",
    appMarker: "handlePostBookingReceipt",
    operationId: "postBookingReceipt",
    requestSchema: "BookingMemberReceiptJsonBody",
    responseSchema: "BookingReceiptCreatedResponse",
    errors: ["400", "401", "403", "503"],
    exampleSurface: "BookingMemberReceiptJsonBody / BookingReceiptCreatedResponse",
  },
  {
    method: "GET",
    path: "/bookings/{bookingId}/receipts",
    appMarker: "handleGetBookingReceiptStatus",
    operationId: "getBookingReceiptStatus",
    requestSchema: null,
    responseSchema: "BookingMemberReceiptStatusResponse",
    errors: ["401", "403"],
    exampleSurface: "BookingMemberReceiptStatusResponse (payment/receipt status)",
  },
];

/** Contract DTOs that must appear as named OpenAPI components. */
const REQUIRED_DTO_SCHEMAS = [
  "BookingStatus",
  "BookingPaymentStatus",
  "BookingsListView",
  "BookingListItem",
  "BookingDetailItem",
  "BookingsListResponse",
  "BookingTourChip",
  "BookingsSummaryResponse",
  "CreateBookingRequest",
  "CreateBookingResponse",
  "ApproveBookingResponse",
  "RejectBookingRequest",
  "RejectBookingResponse",
  "WaitlistBookingResponse",
  "CancelBookingResponse",
  "BulkApproveBookingsRequest",
  "BulkApproveBookingsResponse",
  "BookingMemberReceiptJsonBody",
  "BookingMemberReceiptStatusResponse",
  "BookingHttpError",
] as const;

type OpenApiOp = {
  operationId?: string;
  parameters?: unknown[];
  requestBody?: {
    content?: Record<string, { schema?: { $ref?: string }; examples?: unknown }>;
  };
  responses?: Record<
    string,
    {
      content?: Record<string, { schema?: { $ref?: string }; examples?: unknown }>;
      description?: string;
    }
  >;
};

function schemaRefName(schema: { $ref?: string } | undefined): string | null {
  const ref = schema?.$ref;
  if (typeof ref !== "string" || !ref.startsWith("#/components/schemas/")) {
    return null;
  }
  return ref.slice("#/components/schemas/".length);
}

function collectInlineObjects(node: unknown, path: string, hits: string[]): void {
  if (node === null || typeof node !== "object") {
    return;
  }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) {
      collectInlineObjects(node[i], `${path}[${i}]`, hits);
    }
    return;
  }
  const obj = node as Record<string, unknown>;
  if (obj.type === "object" && obj.properties !== undefined && obj.$ref === undefined) {
    // Allow only inside components.schemas (named). Flag path/request inline objects.
    if (!path.includes("components.schemas.")) {
      hits.push(path);
    }
  }
  for (const [key, value] of Object.entries(obj)) {
    if (key === "examples" || key === "example") continue;
    collectInlineObjects(value, `${path}.${key}`, hits);
  }
}

describe("booking OpenAPI certification", () => {
  const appSrc = readFileSync(join(apiRoot, "src/app.ts"), "utf8");
  const openapi = JSON.parse(
    readFileSync(join(apiRoot, "openapi/openapi.json"), "utf8")
  ) as {
    paths?: Record<string, Record<string, OpenApiOp>>;
    components?: { schemas?: Record<string, Record<string, unknown>> };
  };
  const inventory = DISPATCH_ROUTES.filter((r) => r.path.startsWith("/bookings"));
  const schemas = openapi.components?.schemas ?? {};

  it("inventory covers every registered Booking route (no missing)", () => {
    for (const registered of REGISTERED_BOOKING_ROUTES) {
      assert.ok(
        appSrc.includes(registered.appMarker),
        `app.ts missing handler ${registered.appMarker}`
      );
      const hit = inventory.find(
        (r) => r.method === registered.method && r.path === registered.path
      );
      assert.ok(hit, `DISPATCH_ROUTES missing ${registered.method} ${registered.path}`);
      assert.equal(hit?.operationId, registered.operationId);
    }
  });

  it("inventory has no extra Booking routes beyond registered set", () => {
    const registeredKeys = new Set(
      REGISTERED_BOOKING_ROUTES.map((r) => `${r.method} ${r.path}`)
    );
    for (const route of inventory) {
      const key = `${route.method} ${route.path}`;
      assert.ok(registeredKeys.has(key), `extra inventory route: ${key}`);
    }
    assert.equal(inventory.length, REGISTERED_BOOKING_ROUTES.length);
  });

  it("openapi.json includes every Booking inventory operation (no missing)", () => {
    for (const route of inventory) {
      const op = openapi.paths?.[route.path]?.[route.method.toLowerCase()];
      assert.ok(op, `openapi.json missing ${route.method} ${route.path}`);
      assert.equal(op.operationId, route.operationId);
    }
  });

  it("openapi.json has no Booking paths outside inventory (no extra)", () => {
    const inventoryKeys = new Set(inventory.map((r) => `${r.method} ${r.path}`));
    for (const [oasPath, methods] of Object.entries(openapi.paths ?? {})) {
      if (!oasPath.startsWith("/bookings")) continue;
      for (const method of Object.keys(methods)) {
        const key = `${method.toUpperCase()} ${oasPath}`;
        assert.ok(inventoryKeys.has(key), `extra openapi Booking path: ${key}`);
      }
    }
  });

  it("all Booking DTOs are named components (no missing schemas)", () => {
    for (const name of REQUIRED_DTO_SCHEMAS) {
      assert.ok(schemas[name], `components.schemas missing ${name}`);
      assert.ok(
        BOOKING_OPENAPI_SCHEMAS[name],
        `BOOKING_OPENAPI_SCHEMAS missing ${name}`
      );
      const examples = schemas[name]?.examples;
      assert.ok(
        examples !== undefined || schemas[name]?.example !== undefined,
        `schema ${name} missing examples`
      );
    }
  });

  it("Booking operations: request/response/error schemas + examples (100%)", () => {
    const rows: string[] = [];
    for (const registered of REGISTERED_BOOKING_ROUTES) {
      const op = openapi.paths?.[registered.path]?.[
        registered.method.toLowerCase()
      ] as OpenApiOp | undefined;
      assert.ok(op, `missing op ${registered.operationId}`);
      assert.ok(
        BOOKING_OPENAPI_OVERRIDES[registered.operationId],
        `override missing for ${registered.operationId}`
      );
      assert.ok(
        BOOKING_OPENAPI_OPERATION_IDS.includes(registered.operationId),
        `operation id list missing ${registered.operationId}`
      );

      if (registered.path.includes("{bookingId}")) {
        const params = op.parameters ?? [];
        assert.ok(
          params.some(
            (p) =>
              typeof p === "object" &&
              p !== null &&
              (p as { name?: string }).name === "bookingId" &&
              schemaRefName((p as { schema?: { $ref?: string } }).schema) === "BookingId"
          ),
          `${registered.operationId} missing BookingId path param $ref`
        );
      }

      if (registered.requestSchema !== null) {
        const json = op.requestBody?.content?.["application/json"];
        assert.equal(
          schemaRefName(json?.schema),
          registered.requestSchema,
          `${registered.operationId} request schema`
        );
        assert.ok(json?.examples, `${registered.operationId} request examples`);
      }

      const successCode = registered.method === "POST" && registered.path === "/bookings" ? "201"
        : registered.operationId === "postBookingReceipt" ? "201" : "200";
      const success = op.responses?.[successCode]?.content?.["application/json"];
      assert.equal(
        schemaRefName(success?.schema),
        registered.responseSchema,
        `${registered.operationId} response schema`
      );
      assert.ok(success?.examples, `${registered.operationId} response examples`);

      for (const code of registered.errors) {
        const err = op.responses?.[code];
        assert.ok(err, `${registered.operationId} missing error ${code}`);
        const errJson = err.content?.["application/json"];
        if (errJson !== undefined) {
          assert.equal(
            schemaRefName(errJson.schema),
            "BookingHttpError",
            `${registered.operationId} ${code} must $ref BookingHttpError`
          );
          assert.ok(errJson.examples, `${registered.operationId} ${code} examples`);
        }
      }

      if (registered.operationId === "listBookings") {
        const paymentParam = (op.parameters ?? []).find(
          (p) =>
            typeof p === "object" &&
            p !== null &&
            (p as { name?: string }).name === "paymentStatus"
        ) as { schema?: { $ref?: string }; examples?: unknown } | undefined;
        assert.equal(schemaRefName(paymentParam?.schema), "BookingPaymentStatus");
        assert.ok(paymentParam?.examples);
      }

      rows.push(
        [
          `${registered.method} ${registered.path}`,
          registered.requestSchema ?? "—",
          registered.responseSchema,
          registered.errors.join(","),
          registered.exampleSurface,
        ].join(" | ")
      );
    }

    assert.equal(rows.length, REGISTERED_BOOKING_ROUTES.length);
    assert.equal(rows.length, 11, "coverage must be 100% of registered Booking endpoints");
    console.log("endpoint | request schema | response schema | errors | examples");
    for (const row of rows) {
      console.log(row);
    }
  });

  it("Booking ops have no anonymous object schemas on operations", () => {
    const hits: string[] = [];
    for (const registered of REGISTERED_BOOKING_ROUTES) {
      const op = openapi.paths?.[registered.path]?.[registered.method.toLowerCase()];
      collectInlineObjects(op, `paths.${registered.path}.${registered.method}`, hits);
    }
    assert.deepEqual(hits, [], `anonymous object schemas: ${hits.join("; ")}`);
  });

  it("no duplicated Booking component schema keys", () => {
    const names = Object.keys(BOOKING_OPENAPI_SCHEMAS);
    assert.equal(names.length, new Set(names).size);
    assert.equal(Object.keys(schemas).filter((k) => names.includes(k)).length, names.length);
  });
});
