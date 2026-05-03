import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DataSource } from "typeorm";
import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { TourEntity } from "../modules/tours/entities/tour.entity";
import { RegistrationEntity } from "../modules/registrations/registration.entity";
import { PaymentEntity } from "../modules/payments/entities/payment.entity";
import { UserEntity } from "../modules/identity/entities/user.entity";
import { UserTenantEntity } from "../modules/identity/entities/user-tenant.entity";
import { TenantEntity } from "../modules/identity/entities/tenant.entity";

type SeedOutput = {
  tenantId: string;
  tenantName: string;
  user: {
    id: string;
    email: string;
    password: string;
    role: string;
  };
  tours: Array<{
    id: string;
    title: string;
    totalCapacity: number;
    acceptedCount: number;
  }>;
};

type FlowResult = {
  name: string;
  passed: boolean;
  details: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

async function requestJson<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit
): Promise<{ status: number; body: T }> {
  const res = await fetch(`${baseUrl}${path}`, init);
  const text = await res.text();
  const body = text ? (JSON.parse(text) as T) : ({} as T);
  return { status: res.status, body };
}

async function run(): Promise<void> {
  const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
  const internalApiKey = requireEnv("INTERNAL_API_KEY");
  const seedPath = join(process.cwd(), ".seed-output.json");
  const seed = JSON.parse(await readFile(seedPath, "utf8")) as SeedOutput;

  const results: FlowResult[] = [];
  const flow = (name: string, passed: boolean, details: string) => {
    results.push({ name, passed, details });
  };

  let token = "";
  let selectedTourId = seed.tours[0]?.id ?? "";
  let registrationId = "";
  let providerPaymentId = `freeze-pay-${Date.now()}`;
  const uniqueSuffix = String(Date.now()).slice(-6);
  const participantPhone = `+98912${uniqueSuffix}`;

  try {
    const auth = await requestJson<{
      session_token?: string;
      user_id?: string;
      tenant_id?: string;
    }>(baseUrl, "/api/v2/auth/web/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entry_mode: "web",
        asserted_tenant_id: seed.tenantId,
        credential: {
          email: seed.user.email,
          password: seed.user.password
        }
      })
    });
    token = auth.body.session_token ?? "";
    flow(
      "FLOW 1: AUTH (web session login)",
      auth.status === 200 && token.length > 0,
      `status=${auth.status}, hasToken=${token.length > 0}`
    );

    const tours = await requestJson<{ items: Array<{ id: string; title: string }> }>(
      baseUrl,
      "/api/v2/tours",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    const tourItems = Array.isArray(tours.body?.items) ? tours.body.items : [];
    const seededTitleSet = new Set(seed.tours.map((t) => t.title));
    const matchedSeededTours = tourItems.filter((t) => seededTitleSet.has(t.title));
    if (matchedSeededTours.length > 0) {
      selectedTourId = matchedSeededTours[0].id;
    }
    flow(
      "FLOW 2: LIST TOURS",
      tours.status === 200 && matchedSeededTours.length === 3,
      `status=${tours.status}, seededToursFound=${matchedSeededTours.length}`
    );

    const reg = await requestJson<{ id?: string }>(baseUrl, "/api/v2/registrations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Idempotency-Key": `freeze-reg-${Date.now()}`
      },
      body: JSON.stringify({
        tenantId: seed.tenantId,
        tourId: selectedTourId,
        participantFullName: `Freeze Validation User ${uniqueSuffix}`,
        participantContactPhone: participantPhone,
        transportMode: "group_vehicle",
        entryMode: "web"
      })
    });
    registrationId = reg.body.id ?? "";
    flow(
      "FLOW 3: CREATE REGISTRATION",
      reg.status === 201 && registrationId.length > 0,
      `status=${reg.status}, registrationId=${registrationId || "none"}`
    );

    const idempotencyKey = `freeze-pay-intent-${Date.now()}`;
    let paymentIntentStatus = 0;
    if (!registrationId) {
      flow(
        "FLOW 4: PAYMENT INTENT",
        false,
        "skipped because registration was not created"
      );
    } else {
      const paymentIntent = await requestJson<{
        id?: string;
        providerPaymentId?: string | null;
      }>(baseUrl, "/api/v2/payments/intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify({
          registrationId,
          amount: 100,
          currency: "IRR",
          provider: "mock_provider",
          providerPaymentId
        })
      });
      paymentIntentStatus = paymentIntent.status;
      providerPaymentId = paymentIntent.body.providerPaymentId ?? providerPaymentId;
      flow(
        "FLOW 4: PAYMENT INTENT",
        paymentIntent.status === 201 && providerPaymentId.length > 0,
        `status=${paymentIntent.status}, providerPaymentId=${providerPaymentId}`
      );
    }

    const webhook = await requestJson<{ ok?: boolean }>(baseUrl, "/internal/payments/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Api-Key": internalApiKey
      },
      body: JSON.stringify({
        providerEventId: `freeze-webhook-${Date.now()}`,
        providerPaymentId,
        status: "Paid"
      })
    });
    flow(
      "FLOW 5: WEBHOOK SIMULATION",
      webhook.status === 200 && webhook.body.ok === true,
      `status=${webhook.status}, ok=${String(webhook.body.ok)}`
    );

    if (!registrationId || paymentIntentStatus !== 201) {
      flow(
        "FLOW 6: IDEMPOTENCY REPLAY",
        false,
        "skipped because initial payment intent was not successful"
      );
    } else {
      const paymentReplay = await requestJson<{
        id?: string;
        providerPaymentId?: string | null;
      }>(baseUrl, "/api/v2/payments/intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify({
          registrationId,
          amount: 100,
          currency: "IRR",
          provider: "mock_provider",
          providerPaymentId
        })
      });
      flow(
        "FLOW 6: IDEMPOTENCY REPLAY",
        (paymentReplay.status === 200 || paymentReplay.status === 201) &&
          paymentReplay.body.providerPaymentId === providerPaymentId,
        `status=${paymentReplay.status}, providerPaymentId=${paymentReplay.body.providerPaymentId ?? "none"}`
      );
    }

    const dataSource = new DataSource({
      ...createDataSourceOptionsFromEnv(),
      entities: [
        UserEntity,
        UserTenantEntity,
        TenantEntity,
        TourEntity,
        RegistrationEntity,
        PaymentEntity
      ]
    });
    await dataSource.initialize();
    try {
      const user = await dataSource.getRepository(UserEntity).findOne({
        where: { id: seed.user.id }
      });
      const registration = registrationId
        ? await dataSource.getRepository(RegistrationEntity).findOne({
            where: { id: registrationId }
          })
        : null;
      const payment = providerPaymentId
        ? await dataSource.getRepository(PaymentEntity).findOne({
            where: { providerPaymentId }
          })
        : null;
      const tour = await dataSource.getRepository(TourEntity).findOne({
        where: { id: selectedTourId }
      });
      const paymentRowsForRegistration = registrationId
        ? await dataSource.getRepository(PaymentEntity).count({
            where: { registrationId }
          })
        : 0;

      const finalPass =
        Boolean(user) &&
        registration?.status === "AcceptedPaid" &&
        payment?.status === "Paid" &&
        paymentRowsForRegistration === 1 &&
        typeof tour?.acceptedCount === "number";

      flow(
        "FLOW 7: FINAL VERIFICATION (DB/API)",
        finalPass,
        `registrationStatus=${registration?.status ?? "none"}, paymentStatus=${payment?.status ?? "none"}, paymentRowsForRegistration=${paymentRowsForRegistration}, tourAcceptedCount=${tour?.acceptedCount ?? "none"}`
      );

      console.log("\n=== FREEZE E2E REPORT ===");
      for (const item of results) {
        console.log(
          `[${item.passed ? "PASS" : "FAIL"}] ${item.name} -> ${item.details}`
        );
      }

      console.log("\nFinal DB State:");
      console.log(
        JSON.stringify(
          {
            user: user
              ? {
                  id: user.id,
                  email: user.email,
                  telegramUserId: user.telegramUserId ?? null
                }
              : null,
            registration: registration
              ? {
                  id: registration.id,
                  status: registration.status,
                  paymentStatus: registration.paymentStatus,
                  paidAmount: registration.paidAmount ?? null
                }
              : null,
            payment: payment
              ? {
                  id: payment.id,
                  providerPaymentId: payment.providerPaymentId,
                  status: payment.status,
                  paidAt: payment.paidAt?.toISOString() ?? null
                }
              : null,
            tourCounters: tour
              ? {
                  id: tour.id,
                  title: tour.title,
                  totalCapacity: tour.totalCapacity,
                  acceptedCount: tour.acceptedCount
                }
              : null
          },
          null,
          2
        )
      );
    } finally {
      await dataSource.destroy();
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    flow("UNHANDLED ERROR", false, message);
    console.log("\n=== FREEZE E2E REPORT ===");
    for (const item of results) {
      console.log(
        `[${item.passed ? "PASS" : "FAIL"}] ${item.name} -> ${item.details}`
      );
    }
    process.exitCode = 1;
    return;
  }

  const hasFailure = results.some((item) => !item.passed);
  if (hasFailure) {
    process.exitCode = 1;
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error("Freeze E2E failed:", message);
  process.exitCode = 1;
});
