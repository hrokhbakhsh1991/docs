import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, it } from "node:test";

import {
  applyWorkspaceCatalogCardExposure,
  applyWorkspaceCatalogCardFieldBindings,
  clearWorkspaceCatalogCardStringField,
  omitWorkspaceCatalogCardKey,
  assertWorkspaceOwnerMutation,
  assertWorkspaceRegisteredUserOrThrow,
  assertWorkspaceRegistrationContactBasics,
  assertWorkspaceTypeOrThrow,
  clampWorkspaceCatalogPageLimit,
  createTourDepartureNotSetValidationError,
  createTourNotPublishedValidationError,
  createWorkspaceGuestSmokeHttpHandlers,
  createWorkspaceHttpHostSlot,
  defineWorkspaceCodedError,
  detectWorkspaceTourPublishTransition,
  filterWorkspacePublishedTours,
  loadWorkspaceTourIfPublished,
  mapWorkspaceCatalogSliceAsync,
  mergeWorkspaceCanonicalPatchData,
  normalizeWorkspaceTypeKey,
  parseWorkspaceCatalogCursorLimitQuery,
  parseWorkspaceZodOrThrow,
  buildWorkspaceCatalogListSuccessBody,
  readFiniteCapacityNumber,
  readWorkspaceCanonicalCapacityByPath,
  readWorkspaceHttpHeaderValue,
  readWorkspaceJsonBody,
  requireWorkspacePublishedTour,
  resolveWorkspacePublicAuthFromHeaders,
  resolveWorkspacePublicAuthFromRequest,
  sendWorkspaceGuestStub,
  sendWorkspaceJson,
  sendWorkspaceNotFound,
  buildWorkspaceSuccessDataBody,
  WORKSPACE_HTTP_ERROR_NOT_FOUND,
  sliceWorkspaceCatalogByIdCursor,
  WORKSPACE_PUBLIC_AUTH_MISSING_TENANT,
  WORKSPACE_PUBLIC_AUTH_REGISTERED_USER_REQUIRED,
  WORKSPACE_PUBLIC_CATALOG_GUEST_USER_ID,
  WORKSPACE_REGISTRATION_EMAIL_PATTERN,
  WORKSPACE_REGISTRATION_PHONE_PATTERN,
  workspaceTourPatchTouchesPublishFields,
  type WorkspaceHttpMethod,
} from "../src/http/index";
import type { TenantAuthContext, TenantAuthz } from "../src/auth/index";

describe("workspace-sdk http P-lib (DG-1)", () => {
  it("exports WorkspaceHttpMethod union", () => {
    const method: WorkspaceHttpMethod = "GET";
    assert.equal(method, "GET");
  });

  it("sendWorkspaceJson writes JSON body and status", () => {
    const headers: Record<string, string> = {};
    let ended: string | undefined;
    const res = {
      statusCode: 0,
      setHeader(name: string, value: string) {
        headers[name] = value;
      },
      end(chunk: string) {
        ended = chunk;
      },
    } as unknown as ServerResponse;

    sendWorkspaceJson(res, 200, { ok: true });
    assert.equal(res.statusCode, 200);
    assert.equal(headers["Content-Type"], "application/json; charset=utf-8");
    assert.equal(ended, JSON.stringify({ ok: true }));
  });

  it("sendWorkspaceNotFound / sendWorkspaceGuestStub use stable codes", () => {
    const capture = () => {
      let ended: string | undefined;
      const res = {
        statusCode: 0,
        setHeader() {},
        end(chunk: string) {
          ended = chunk;
        },
      } as unknown as ServerResponse;
      return {
        res,
        get body() {
          return ended ? JSON.parse(ended) : null;
        },
      };
    };

    const notFound = capture();
    sendWorkspaceNotFound(notFound.res);
    assert.equal(notFound.res.statusCode, 404);
    assert.equal(notFound.body.code, "NOT_FOUND");

    const stub = capture();
    sendWorkspaceGuestStub(stub.res);
    assert.equal(stub.res.statusCode, 501);
    assert.equal(stub.body.code, "WORKSPACE_GUEST_STUB");
  });

  it("readWorkspaceJsonBody parses body chunks", async () => {
    const req = new EventEmitter() as IncomingMessage;
    const pending = readWorkspaceJsonBody(req);
    req.emit("data", Buffer.from('{"a":1}'));
    req.emit("end");
    assert.deepEqual(await pending, { a: 1 });
  });

  it("assertWorkspaceOwnerMutation throws via workspace error factory", () => {
    const auth = {
      tenantId: "t1",
      actorId: "u1",
      roles: [],
    } as unknown as TenantAuthContext;
    const authz = {
      canPerformWorkspaceOwnerMutation: () => false,
    } as unknown as TenantAuthz;

    assert.throws(
      () =>
        assertWorkspaceOwnerMutation({
          auth,
          authz,
          workspaceType: "demo",
          surface: "settings",
          canPerform: () => false,
          createOwnerRequiredError: (surface) => new Error(`OWNER_REQUIRED:${surface}`),
        }),
      /OWNER_REQUIRED:settings/,
    );
  });
});

describe("workspace-sdk http P-lib (DG-1.2)", () => {
  it("createWorkspaceHttpHostSlot configure/get/reset/tryGet", () => {
    const slot = createWorkspaceHttpHostSlot<{ readonly n: number }>({
      notConfiguredCode: "HOST_MISSING",
    });
    assert.equal(slot.tryGet(), null);
    assert.throws(() => slot.get(), /HOST_MISSING/);
    slot.configure({ n: 7 });
    assert.equal(slot.tryGet()?.n, 7);
    assert.equal(slot.get().n, 7);
    slot.resetForTests();
    assert.equal(slot.tryGet(), null);
    assert.throws(() => slot.get(), /HOST_MISSING/);
  });

  it("defineWorkspaceCodedError preserves code + surface", () => {
    const defined = defineWorkspaceCodedError({
      code: "DEMO_OWNER_REQUIRED",
      name: "DemoOwnerRequiredError",
      withSurface: true,
    });
    const err = new defined.ErrorClass("settings");
    assert.equal(err.code, "DEMO_OWNER_REQUIRED");
    assert.equal(err.surface, "settings");
    assert.equal(err.name, "DemoOwnerRequiredError");
    assert.equal(defined.isError(err), true);
    assert.equal(defined.isError({ code: "DEMO_OWNER_REQUIRED" }), true);
  });

  it("mergeWorkspaceCanonicalPatchData shallow vs deep-root", () => {
    const existing = { tour: { title: "a", city: "x" }, meta: 1 };
    const shallow = mergeWorkspaceCanonicalPatchData(
      existing,
      { tour: { title: "b" } },
      "shallow",
    );
    assert.deepEqual(shallow.tour, { title: "b" });

    const deep = mergeWorkspaceCanonicalPatchData(
      existing,
      { tour: { title: "b" } },
      "deep-root",
    );
    assert.deepEqual(deep.tour, { title: "b", city: "x" });
    assert.equal(mergeWorkspaceCanonicalPatchData(existing, undefined, "deep-root"), existing);
  });
});


describe("workspace-sdk http P-lib (DG-1.3)", () => {
  it("clampWorkspaceCatalogPageLimit defaults and clamps", () => {
    assert.equal(clampWorkspaceCatalogPageLimit({}), 20);
    assert.equal(clampWorkspaceCatalogPageLimit({ limit: 0 }), 1);
    assert.equal(clampWorkspaceCatalogPageLimit({ limit: 999 }), 50);
    assert.equal(clampWorkspaceCatalogPageLimit({ limit: 12 }), 12);
  });

  it("sliceWorkspaceCatalogByIdCursor pages by id", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const first = sliceWorkspaceCatalogByIdCursor(items, { limit: 2 });
    assert.deepEqual(first.slice.map((x) => x.id), ["a", "b"]);
    assert.equal(first.nextCursor, "b");
    const second = sliceWorkspaceCatalogByIdCursor(items, { limit: 2, cursor: "b" });
    assert.deepEqual(second.slice.map((x) => x.id), ["c", "d"]);
    assert.equal(second.nextCursor, null);
  });

  it("mapWorkspaceCatalogSliceAsync preserves order", async () => {
    const out = await mapWorkspaceCatalogSliceAsync([1, 2, 3], async (n) => n * 10);
    assert.deepEqual(out, [10, 20, 30]);
  });

  it("filterWorkspacePublishedTours keeps published only", () => {
    const items = [
      { id: "1", canonical: "draft" },
      { id: "2", canonical: "active" },
    ];
    const published = filterWorkspacePublishedTours(items, {
      isPublished: (c) => c === "active",
      getCanonical: (t) => t.canonical,
    });
    assert.deepEqual(published.map((t) => t.id), ["2"]);
  });

  it("applyWorkspaceCatalogCardExposure skips when port missing", async () => {
    const card = { title: "x" };
    const result = await applyWorkspaceCatalogCardExposure({
      tenantId: "t",
      tourId: "1",
      canonical: { schemaVersion: 1, data: {} } as never,
      card,
      resolveCoordinate: () => ({ surface: "list" }),
      applyExposure: (c, ids) => ({ ...c, n: ids.size }),
    });
    assert.deepEqual(result, card);
  });

  it("applyWorkspaceCatalogCardExposure applies visible fields", async () => {
    const card = { title: "x" };
    const result = await applyWorkspaceCatalogCardExposure({
      tenantId: "t",
      tourId: "1",
      canonical: { schemaVersion: 1, data: {} } as never,
      card,
      exposurePort: {
        async resolveVisibleFieldIds() {
          return ["title"];
        },
      },
      resolveCoordinate: () => ({ surface: "list" }),
      applyExposure: (c, ids) => ({ ...c, kept: [...ids] }),
    });
    assert.deepEqual(result, { title: "x", kept: ["title"] });
  });

  it("applyWorkspaceCatalogCardFieldBindings hides non-visible fields", () => {
    const card = { title: "t", city: "c", price: 1 };
    const out = applyWorkspaceCatalogCardFieldBindings(
      card,
      new Set(["title"]),
      [
        { fieldId: "title", applyHidden: (c) => ({ ...c, title: "Untitled" }) },
        { fieldId: "city", applyHidden: (c) => ({ ...c, city: null }) },
        { fieldId: "price", applyHidden: (c) => ({ ...c, price: null }) },
      ],
    );
    assert.deepEqual(out, { title: "t", city: null, price: null });
  });

  it("clearWorkspaceCatalogCardStringField / omitWorkspaceCatalogCardKey", () => {
    const card = { title: "t", city: "c", structuredData: { a: 1 } };
    assert.deepEqual(clearWorkspaceCatalogCardStringField(card, "city"), {
      title: "t",
      city: null,
      structuredData: { a: 1 },
    });
    const omitted = omitWorkspaceCatalogCardKey(card, "structuredData");
    assert.equal("structuredData" in omitted, false);
    assert.equal(omitted.title, "t");
  });
});


describe("workspace-sdk http P-lib (DG-1.4)", () => {
  it("detectWorkspaceTourPublishTransition covers edges", () => {
    assert.equal(detectWorkspaceTourPublishTransition(false, true), "published");
    assert.equal(detectWorkspaceTourPublishTransition(true, false), "unpublished");
    assert.equal(detectWorkspaceTourPublishTransition(true, true), null);
    assert.equal(detectWorkspaceTourPublishTransition(false, false), null);
  });

  it("workspaceTourPatchTouchesPublishFields uses paths + predicate", () => {
    assert.equal(
      workspaceTourPatchTouchesPublishFields(
        { roots: ["tour.publishStatus"] },
        {
          protectedPaths: ["tour.publishStatus"],
          dataTouchesPublishFields: () => false,
        },
      ),
      true,
    );
    assert.equal(
      workspaceTourPatchTouchesPublishFields(
        { data: { tour: { title: "x" } } },
        {
          protectedPaths: ["tour.publishStatus"],
          dataTouchesPublishFields: (data) => "tour" in data,
        },
      ),
      true,
    );
    assert.equal(
      workspaceTourPatchTouchesPublishFields(
        { data: { tour: { title: "x" } } },
        {
          protectedPaths: ["tour.publishStatus"],
          dataTouchesPublishFields: () => false,
        },
      ),
      false,
    );
  });
});


describe("workspace-sdk http P-lib (DG-1.5 registration guards)", () => {
  it("assertWorkspaceTypeOrThrow throws via factory", () => {
    assert.throws(
      () => assertWorkspaceTypeOrThrow("a", "b", () => new Error("WS_REQUIRED")),
      /WS_REQUIRED/,
    );
    assert.doesNotThrow(() => assertWorkspaceTypeOrThrow("a", "a", () => new Error("WS_REQUIRED")));
  });

  it("createTourNotPublishedValidationError has stable shape", () => {
    const err = createTourNotPublishedValidationError();
    assert.equal(err.message, "ZOD_VALIDATION_FAILED");
    assert.deepEqual(err.details, { tourId: ["TOUR_NOT_PUBLISHED"] });
  });

  it("createTourDepartureNotSetValidationError has stable shape", () => {
    const err = createTourDepartureNotSetValidationError();
    assert.equal(err.message, "ZOD_VALIDATION_FAILED");
    assert.deepEqual(err.details, { tourId: ["TOUR_DEPARTURE_NOT_SET"] });
  });

  it("readFiniteCapacityNumber filters non-finite", () => {
    assert.equal(readFiniteCapacityNumber(12), 12);
    assert.equal(readFiniteCapacityNumber(Number.NaN), null);
    assert.equal(readFiniteCapacityNumber("12"), null);
  });

  it("readWorkspaceCanonicalCapacityByPath walks nested paths", () => {
    assert.equal(
      readWorkspaceCanonicalCapacityByPath({ data: { capacityMax: 8 } }, ["capacityMax"]),
      8,
    );
    assert.equal(
      readWorkspaceCanonicalCapacityByPath({ data: { tour: { capacity: 4 } } }, ["tour", "capacity"]),
      4,
    );
    assert.equal(
      readWorkspaceCanonicalCapacityByPath({ data: { tour: null } }, ["tour", "capacity"]),
      null,
    );
    assert.equal(readWorkspaceCanonicalCapacityByPath({ data: {} }, []), null);
  });

  it("loadWorkspaceTourIfPublished returns null when missing or unpublished", async () => {
    assert.equal(
      await loadWorkspaceTourIfPublished({
        findFirst: async () => null,
        isPublished: () => true,
        getCanonical: (t: { canonical: string }) => t.canonical,
      }),
      null,
    );
    assert.equal(
      await loadWorkspaceTourIfPublished({
        findFirst: async () => ({ canonical: "draft" }),
        isPublished: (c: string) => c === "active",
        getCanonical: (t: { canonical: string }) => t.canonical,
      }),
      null,
    );
    const tour = { canonical: "active" };
    assert.equal(
      await loadWorkspaceTourIfPublished({
        findFirst: async () => tour,
        isPublished: (c: string) => c === "active",
        getCanonical: (t: { canonical: string }) => t.canonical,
      }),
      tour,
    );
  });

  it("requireWorkspacePublishedTour throws not-published when miss", async () => {
    await assert.rejects(
      () =>
        requireWorkspacePublishedTour({
          findFirst: async () => null,
          isPublished: () => true,
          getCanonical: (t: { canonical: string }) => t.canonical,
        }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, "ZOD_VALIDATION_FAILED");
        assert.deepEqual(
          (err as Error & { details: Record<string, string[]> }).details,
          { tourId: ["TOUR_NOT_PUBLISHED"] },
        );
        return true;
      },
    );
  });

  it("assertWorkspaceRegistrationContactBasics validates shared contact gates", () => {
    assert.match("a@b.co", WORKSPACE_REGISTRATION_EMAIL_PATTERN);
    assert.match("+1 (555) 010-0", WORKSPACE_REGISTRATION_PHONE_PATTERN);

    assert.throws(
      () =>
        assertWorkspaceRegistrationContactBasics({
          email: "bad",
          emailRequired: true,
          fullName: "Ada",
          partySize: 1,
          partySizeRequired: true,
          capacity: null,
          enforcePartySizeCapacity: false,
          createInvalidError: () => new Error("INVALID"),
        }),
      /INVALID/,
    );

    assert.doesNotThrow(() =>
      assertWorkspaceRegistrationContactBasics({
        email: "",
        emailRequired: false,
        fullName: "Ada",
        partySize: 2,
        partySizeRequired: true,
        capacity: 10,
        enforcePartySizeCapacity: false,
        createInvalidError: () => new Error("INVALID"),
      }),
    );

    assert.throws(
      () =>
        assertWorkspaceRegistrationContactBasics({
          email: "ada@example.com",
          emailRequired: true,
          fullName: "Ada",
          partySize: 5,
          partySizeRequired: false,
          capacity: 2,
          enforcePartySizeCapacity: true,
          createInvalidError: () => new Error("INVALID"),
        }),
      /INVALID/,
    );
  });
});

describe("workspace-sdk http P-lib (DG-1.6 type-key normalize)", () => {
  it("normalizeWorkspaceTypeKey trims and lower-cases", () => {
    assert.equal(normalizeWorkspaceTypeKey("  Denali "), "denali");
    assert.equal(normalizeWorkspaceTypeKey("urban"), "urban");
  });
});

describe("workspace-sdk http P-lib (DG-1.7 public auth)", () => {
  it("resolveWorkspacePublicAuthFromHeaders uses guest id", () => {
    const auth = resolveWorkspacePublicAuthFromHeaders({
      tenantId: "00000000-0000-4000-8000-000000000004",
    });
    assert.equal(auth.userId, WORKSPACE_PUBLIC_CATALOG_GUEST_USER_ID);
    assert.equal(auth.role, "none");
  });

  it("resolveWorkspacePublicAuthFromHeaders requires tenant", () => {
    assert.throws(
      () => resolveWorkspacePublicAuthFromHeaders({}),
      (err: unknown) =>
        err instanceof Error && err.message === WORKSPACE_PUBLIC_AUTH_MISSING_TENANT,
    );
  });

  it("readWorkspaceHttpHeaderValue trims multi-value", () => {
    assert.equal(readWorkspaceHttpHeaderValue(["  a  ", "b"]), "a");
    assert.equal(readWorkspaceHttpHeaderValue("  "), undefined);
  });

  it("resolveWorkspacePublicAuthFromRequest reads x-tenant-id", () => {
    const req = {
      headers: { "x-tenant-id": "tenant-1", "x-actor-role": "member", "x-user-id": "user-1" },
    } as IncomingMessage;
    const auth = resolveWorkspacePublicAuthFromRequest(req);
    assert.equal(auth.tenantId, "tenant-1");
    assert.equal(auth.userId, "user-1");
    assert.equal(auth.role, "member");
  });

  it("assertWorkspaceRegisteredUserOrThrow rejects guest", () => {
    assert.throws(
      () =>
        assertWorkspaceRegisteredUserOrThrow({
          userId: WORKSPACE_PUBLIC_CATALOG_GUEST_USER_ID,
        }),
      (err: unknown) =>
        err instanceof Error &&
        err.message === WORKSPACE_PUBLIC_AUTH_REGISTERED_USER_REQUIRED,
    );
    assert.doesNotThrow(() =>
      assertWorkspaceRegisteredUserOrThrow({ userId: "real-user" }),
    );
  });
});

describe("workspace-sdk http P-lib (DG-1.8 catalog route helpers)", () => {
  it("parseWorkspaceCatalogCursorLimitQuery reads cursor/limit", () => {
    const url = new URL("http://x/catalog?cursor=c1&limit=7");
    assert.deepEqual(parseWorkspaceCatalogCursorLimitQuery(url), {
      cursor: "c1",
      limit: 7,
    });
    assert.deepEqual(
      parseWorkspaceCatalogCursorLimitQuery(new URL("http://x/catalog?limit=nope")),
      {},
    );
  });

  it("buildWorkspaceCatalogListSuccessBody shapes envelope", () => {
    assert.deepEqual(
      buildWorkspaceCatalogListSuccessBody({ items: [{ id: "a" }], nextCursor: null }),
      {
        success: true,
        data: { items: [{ id: "a" }] },
        metadata: { nextCursor: null },
      },
    );
  });

  it("parseWorkspaceZodOrThrow returns data or throws ZOD_VALIDATION_FAILED", () => {
    assert.equal(
      parseWorkspaceZodOrThrow({ success: true, data: { ok: 1 } }).ok,
      1,
    );
    assert.throws(
      () =>
        parseWorkspaceZodOrThrow({
          success: false,
          error: { flatten: () => ({ fieldErrors: { tourId: ["Required"] } }) },
        }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, "ZOD_VALIDATION_FAILED");
        assert.deepEqual((err as Error & { details: unknown }).details, {
          fieldErrors: { tourId: ["Required"] },
        });
        return true;
      },
    );
  });
});

describe("workspace-sdk http P-lib (DG-1.9 success envelopes)", () => {
  it("buildWorkspaceSuccessDataBody wraps data", () => {
    assert.deepEqual(buildWorkspaceSuccessDataBody({ id: "t1" }), {
      success: true,
      data: { id: "t1" },
    });
  });

  it("WORKSPACE_HTTP_ERROR_NOT_FOUND is stable", () => {
    assert.deepEqual(WORKSPACE_HTTP_ERROR_NOT_FOUND, {
      error: "not_found",
      code: "NOT_FOUND",
    });
  });
});

describe("workspace-sdk http P-lib (DG-4.3 guest smoke handlers)", () => {
  function mockRes(): ServerResponse & { body: string; status: number } {
    let body = "";
    let status = 0;
    const res = {
      get body() {
        return body;
      },
      get status() {
        return status;
      },
      set statusCode(value: number) {
        status = value;
      },
      get statusCode() {
        return status;
      },
      setHeader() {},
      end(chunk?: string) {
        body = chunk ?? "";
      },
    };
    return res as unknown as ServerResponse & { body: string; status: number };
  }

  it("stubs when seed disabled; lists when enabled", async () => {
    let seeded = false;
    const handlers = createWorkspaceGuestSmokeHttpHandlers({
      isSeedEnabled: () => seeded,
      publishedTourId: "tour-1",
      buildCard: () => ({ id: "tour-1", title: "Sail" }),
    });
    const stub = mockRes();
    await handlers.handleList({ url: "/x/catalog" } as IncomingMessage, stub);
    assert.equal(stub.status, 501);

    seeded = true;
    const list = mockRes();
    await handlers.handleList({ url: "/x/catalog" } as IncomingMessage, list);
    assert.equal(list.status, 200);
    assert.equal(JSON.parse(list.body).data.items[0].id, "tour-1");
  });

  it("applies optional list filter + limit", async () => {
    const handlers = createWorkspaceGuestSmokeHttpHandlers({
      isSeedEnabled: () => true,
      publishedTourId: "tour-1",
      buildCard: () => ({ id: "tour-1", city: "bandar" }),
      filterListItems: (items, url) => {
        const city = url.searchParams.get("city");
        if (!city) return items;
        return items.filter((item) => item.city === city);
      },
      applyListLimit: true,
    });
    const miss = mockRes();
    await handlers.handleList(
      { url: "/x/catalog?city=tehran" } as IncomingMessage,
      miss,
    );
    assert.deepEqual(JSON.parse(miss.body).data.items, []);

    const limited = mockRes();
    await handlers.handleList(
      { url: "/x/catalog?limit=0" } as IncomingMessage,
      limited,
    );
    assert.deepEqual(JSON.parse(limited.body).data.items, []);
  });

  it("uses catalogPort when provided (DG-4.6)", async () => {
    const cards = [{ id: "port-tour", title: "Port sail" }];
    const regs: Array<{ id: string; tourId: string; status: string }> = [];
    const handlers = createWorkspaceGuestSmokeHttpHandlers({
      isSeedEnabled: () => true,
      publishedTourId: "ignored",
      buildCard: () => ({ id: "fixture", title: "unused" }),
      catalogPort: {
        listPublished: () => cards,
        getPublished: (id) => cards.find((card) => card.id === id) ?? null,
        createRegistration: (input) => {
          const row = { id: "reg-1", tourId: input.tourId, status: "pending" };
          regs.push(row);
          return row;
        },
      },
    });

    const list = mockRes();
    await handlers.handleList({ url: "/x/catalog" } as IncomingMessage, list);
    assert.equal(JSON.parse(list.body).data.items[0].id, "port-tour");

    const detail = mockRes();
    await handlers.handleDetail({} as IncomingMessage, detail, "port-tour");
    assert.equal(detail.status, 200);

    const created = mockRes();
    const req = new EventEmitter() as IncomingMessage & EventEmitter;
    queueMicrotask(() => {
      req.emit(
        "data",
        Buffer.from(
          JSON.stringify({
            tourId: "port-tour",
            contact: { fullName: "Port Guest", email: "p@example.com" },
            partySize: 1,
          }),
          "utf8",
        ),
      );
      req.emit("end");
    });
    await handlers.handleRegister(req, created);
    assert.equal(created.status, 201);
    assert.equal(regs.length, 1);
    assert.equal(regs[0]?.tourId, "port-tour");
  });

  it("PSR-6c1 durable mode skips 501 and awaits async catalogPort", async () => {
    const cards = [{ id: "durable-tour", title: "Durable sail" }];
    const handlers = createWorkspaceGuestSmokeHttpHandlers({
      isSeedEnabled: () => false,
      isDurableEnabled: () => true,
      publishedTourId: "ignored",
      buildCard: () => ({ id: "fixture", title: "must-not-use" }),
      catalogPort: {
        listPublished: async () => cards,
        getPublished: async (id) => cards.find((card) => card.id === id) ?? null,
        createRegistration: async (input) => ({
          id: "reg-durable",
          tourId: input.tourId,
          status: "pending",
        }),
      },
    });

    const list = mockRes();
    await handlers.handleList({ url: "/x/catalog" } as IncomingMessage, list);
    assert.equal(list.status, 200);
    assert.equal(JSON.parse(list.body).data.items[0].id, "durable-tour");

    const emptyDurable = createWorkspaceGuestSmokeHttpHandlers({
      isSeedEnabled: () => false,
      isDurableEnabled: () => true,
      publishedTourId: "x",
      buildCard: () => ({ id: "fixture", title: "unused" }),
    });
    const emptyList = mockRes();
    await emptyDurable.handleList(
      { url: "/x/catalog" } as IncomingMessage,
      emptyList,
    );
    assert.equal(emptyList.status, 200);
    assert.deepEqual(JSON.parse(emptyList.body).data.items, []);
  });
});
