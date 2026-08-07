/**
 * Dev staging — place the 50 ordinary Denali members across registration × payment buckets
 * on tour …0220 (North Ridge Trek) for portal/ops/finance UX evaluation.
 *
 * Idempotent upserts on stable UUIDs …0501–…0550 (regs), …0801–…0850 (payments), …0901–…0950 (receipts).
 *
 * Run:
 *   NODE_ENV=development pnpm --filter @apps/api exec node --import tsx --env-file=.env --env-file=.env.local scripts/seed-denali-registration-matrix-staging.ts
 */
import { DENALI_SMOKE_TENANT_ID } from "@app-tour/workspace-denali";

import {
  DENALI_CLUB_DEV_PUBLISHED_TOUR_ID,
  OPERATOR_SMOKE_PUBLISHED_TOUR_TITLE,
} from "../src/fixtures/operator-smoke-published-tour.fixture";
import { getPrismaAdmin } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";
import { DENALI_DEV_OWNER_USER_ID } from "./seed-denali-operator-identity";

const TOUR_ID = DENALI_CLUB_DEV_PUBLISHED_TOUR_ID;
const TOUR_TITLE = OPERATOR_SMOKE_PUBLISHED_TOUR_TITLE;
const OBLIGATION_MINOR = "2500000";
const CURRENCY = "IRR";
const PARTY_SIZE = 1;

/** Bucket order for members …0301–…0350 (50). */
const BUCKETS = [
  ...Array.from({ length: 8 }, () => "A" as const), // pending · unpaid
  ...Array.from({ length: 4 }, () => "B" as const), // waitlisted · unpaid
  ...Array.from({ length: 12 }, () => "C" as const), // approved · unpaid · no receipt
  ...Array.from({ length: 8 }, () => "D" as const), // approved · unpaid · receipt Pending
  ...Array.from({ length: 4 }, () => "E" as const), // approved · unpaid · receipt Rejected
  ...Array.from({ length: 8 }, () => "F" as const), // approved · paid · receipt Approved
  ...Array.from({ length: 4 }, () => "G" as const), // rejected
  ...Array.from({ length: 2 }, () => "H" as const), // cancelled
] as const;

type Bucket = (typeof BUCKETS)[number];

function padUuidSuffix(n: number): string {
  return String(n).padStart(12, "0");
}

function memberUserId(index1: number): string {
  return `00000000-0000-4000-8000-${padUuidSuffix(300 + index1)}`;
}

function memberMobile(index1: number): string {
  return `+15550003${String(index1).padStart(3, "0")}`;
}

function registrationId(index1: number): string {
  return `00000000-0000-4000-8000-${padUuidSuffix(500 + index1)}`;
}

function paymentId(index1: number): string {
  return `00000000-0000-4000-8000-${padUuidSuffix(800 + index1)}`;
}

function receiptId(index1: number): string {
  return `00000000-0000-4000-8000-${padUuidSuffix(900 + index1)}`;
}

function displayNameFromMeta(meta: unknown, fallback: string): string {
  if (meta !== null && typeof meta === "object" && !Array.isArray(meta)) {
    const name = (meta as Record<string, unknown>).displayName;
    if (typeof name === "string" && name.trim().length > 0) {
      return name.trim();
    }
  }
  return fallback;
}

export async function seedDenaliRegistrationMatrix(): Promise<{
  readonly tourId: string;
  readonly counts: Record<Bucket, number>;
  readonly rows: ReadonlyArray<{
    readonly bucket: Bucket;
    readonly index: number;
    readonly registrationId: string;
    readonly mobile: string;
    readonly guestLabel: string;
  }>;
}> {
  if (BUCKETS.length !== 50) {
    throw new Error(`DENALI_REG_MATRIX_BUCKET_COUNT:${BUCKETS.length}`);
  }

  const prisma = getPrismaAdmin();
  const now = new Date();
  const departureAt = new Date(now);
  departureAt.setUTCDate(departureAt.getUTCDate() + 14);

  const tour = await prisma.tour.findUnique({ where: { id: TOUR_ID } });
  if (tour === null || tour.tenantId !== DENALI_SMOKE_TENANT_ID) {
    throw new Error(`DENALI_REG_MATRIX_TOUR_MISSING:${TOUR_ID}`);
  }

  const counts: Record<Bucket, number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    E: 0,
    F: 0,
    G: 0,
    H: 0,
  };
  const rows: Array<{
    bucket: Bucket;
    index: number;
    registrationId: string;
    mobile: string;
    guestLabel: string;
  }> = [];

  for (let i = 1; i <= 50; i++) {
    const bucket = BUCKETS[i - 1]!;
    const userId = memberUserId(i);
    const mobile = memberMobile(i);
    const regId = registrationId(i);
    const payId = paymentId(i);
    const rcptId = receiptId(i);

    const membership = await prisma.userTenant.findUnique({
      where: {
        userId_tenantId: { userId, tenantId: DENALI_SMOKE_TENANT_ID },
      },
    });
    if (membership === null) {
      throw new Error(`DENALI_REG_MATRIX_MEMBER_MISSING:${userId}`);
    }
    const guestLabel = displayNameFromMeta(membership.membershipMetadata, `Member ${i}`);

    const status =
      bucket === "A"
        ? "pending"
        : bucket === "B"
          ? "waitlisted"
          : bucket === "G"
            ? "rejected"
            : bucket === "H"
              ? "cancelled"
              : "approved";

    const paymentStatus = bucket === "F" ? "paid" : "unpaid";
    const approvedAt = status === "approved" ? now : null;
    const rejectReason = bucket === "G" ? "Staging matrix — capacity / screening reject" : null;

    await withTenantRls(DENALI_SMOKE_TENANT_ID, async (tx) => {
      await tx.operatorRegistration.upsert({
        where: { id: regId },
        create: {
          id: regId,
          tenantId: DENALI_SMOKE_TENANT_ID,
          tourId: TOUR_ID,
          tourTitle: TOUR_TITLE,
          guestLabel,
          guestEmail: `member${String(i).padStart(2, "0")}@staging.denali.test`,
          guestPhone: mobile,
          partySize: PARTY_SIZE,
          status,
          paymentStatus,
          departureAt,
          submittedAt: now,
          submittedByUserId: userId,
          approvedAt,
          rejectReason,
          registrationIntake: {
            matrixBucket: bucket,
            matrixSeed: "denali-registration-matrix-v1",
          },
        },
        update: {
          tourId: TOUR_ID,
          tourTitle: TOUR_TITLE,
          guestLabel,
          guestEmail: `member${String(i).padStart(2, "0")}@staging.denali.test`,
          guestPhone: mobile,
          partySize: PARTY_SIZE,
          status,
          paymentStatus,
          departureAt,
          submittedAt: now,
          submittedByUserId: userId,
          approvedAt,
          rejectReason,
          registrationIntake: {
            matrixBucket: bucket,
            matrixSeed: "denali-registration-matrix-v1",
          },
        },
      });

      // Clear prior finance rows for this registration (idempotent re-seed).
      await tx.paymentReceipt.deleteMany({
        where: { tenantId: DENALI_SMOKE_TENANT_ID, payment: { registrationId: regId } },
      });
      await tx.payment.deleteMany({
        where: { tenantId: DENALI_SMOKE_TENANT_ID, registrationId: regId },
      });

      if (bucket === "D" || bucket === "E" || bucket === "F") {
        const payStatus = bucket === "F" ? "Paid" : "Pending";
        const receiptStatus =
          bucket === "D" ? "Pending" : bucket === "E" ? "Rejected" : "Approved";

        await tx.payment.upsert({
          where: { id: payId },
          create: {
            id: payId,
            tenantId: DENALI_SMOKE_TENANT_ID,
            registrationId: regId,
            amount: OBLIGATION_MINOR,
            currency: CURRENCY,
            method: "Manual",
            provider: "manual",
            status: payStatus,
            paidAt: bucket === "F" ? now : null,
          },
          update: {
            registrationId: regId,
            amount: OBLIGATION_MINOR,
            currency: CURRENCY,
            method: "Manual",
            provider: "manual",
            status: payStatus,
            paidAt: bucket === "F" ? now : null,
            failedAt: null,
            refundedAt: null,
            ledgerJournalId: null,
          },
        });

        await tx.paymentReceipt.upsert({
          where: { id: rcptId },
          create: {
            id: rcptId,
            tenantId: DENALI_SMOKE_TENANT_ID,
            paymentId: payId,
            fileKey: `receipts/${DENALI_SMOKE_TENANT_ID}/${regId}/matrix-${bucket.toLowerCase()}.jpg`,
            status: receiptStatus,
            note: `Denali matrix bucket ${bucket}`,
            reviewedByUserId:
              receiptStatus === "Pending" ? null : DENALI_DEV_OWNER_USER_ID,
            reviewedAt: receiptStatus === "Pending" ? null : now,
            reviewNote:
              receiptStatus === "Rejected"
                ? "Staging matrix — unclear transfer reference"
                : receiptStatus === "Approved"
                  ? "Staging matrix — approved"
                  : null,
          },
          update: {
            paymentId: payId,
            fileKey: `receipts/${DENALI_SMOKE_TENANT_ID}/${regId}/matrix-${bucket.toLowerCase()}.jpg`,
            status: receiptStatus,
            note: `Denali matrix bucket ${bucket}`,
            reviewedByUserId:
              receiptStatus === "Pending" ? null : DENALI_DEV_OWNER_USER_ID,
            reviewedAt: receiptStatus === "Pending" ? null : now,
            reviewNote:
              receiptStatus === "Rejected"
                ? "Staging matrix — unclear transfer reference"
                : receiptStatus === "Approved"
                  ? "Staging matrix — approved"
                  : null,
            ledgerJournalId: null,
          },
        });
      } else {
        // Ensure leftover payment/receipt ids from prior runs on this slot are gone.
        await tx.paymentReceipt.deleteMany({ where: { id: rcptId } });
        await tx.payment.deleteMany({ where: { id: payId } });
      }
    });

    counts[bucket] += 1;
    rows.push({
      bucket,
      index: i,
      registrationId: regId,
      mobile,
      guestLabel,
    });
  }

  return { tourId: TOUR_ID, counts, rows };
}

async function main(): Promise<void> {
  const result = await seedDenaliRegistrationMatrix();
  const byBucket = Object.fromEntries(
    (Object.keys(result.counts) as Bucket[]).map((b) => [
      b,
      result.rows
        .filter((r) => r.bucket === b)
        .map((r) => ({ mobile: r.mobile, registrationId: r.registrationId, guest: r.guestLabel })),
    ])
  );
  console.log(
    JSON.stringify(
      {
        ok: true,
        tenantId: DENALI_SMOKE_TENANT_ID,
        tourId: result.tourId,
        tourTitle: TOUR_TITLE,
        counts: result.counts,
        legend: {
          A: "pending · unpaid · no receipt (awaiting club approval)",
          B: "waitlisted · unpaid",
          C: "approved · unpaid · no receipt (upload form)",
          D: "approved · unpaid · receipt Pending (finance queue)",
          E: "approved · unpaid · receipt Rejected (re-upload)",
          F: "approved · paid · receipt Approved",
          G: "rejected · closed",
          H: "cancelled · closed",
        },
        sampleByBucket: Object.fromEntries(
          (Object.keys(byBucket) as Bucket[]).map((b) => [b, byBucket[b]!.slice(0, 2)])
        ),
      },
      null,
      2
    )
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(async () => {
      await getPrismaAdmin().$disconnect();
    })
    .catch(async (error: unknown) => {
      console.error(error);
      await getPrismaAdmin().$disconnect().catch(() => undefined);
      process.exit(1);
    });
}
