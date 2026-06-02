/**
 * Seeds many registration rows visible on GET /api/v2/bookings for leader@test.com.
 * Uses syntheticBookingContactPhone(leader.id) — same rule as RegistrationsService.listBookings.
 *
 * Prerequisites: DB migrated; `pnpm seed` + `pnpm seed:demo-leader-tours` (or existing tenant/tours).
 *
 * From apps/api:
 *   pnpm seed:leader-bookings
 * Optional: SEED_LEADER_BOOKINGS_COUNT=80 pnpm seed:leader-bookings
 *
 * Idempotent marker: rows use participant_note = SEED_NOTE; re-run deletes prior seeded rows for that phone+tenant then inserts fresh.
 */
import { DataSource, IsNull } from "typeorm";
import { syntheticBookingContactPhone } from "../common/security/ownership-scope";
import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { UserEntity } from "../modules/identity/entities/user.entity";
import { UserTenantEntity } from "../modules/identity/entities/user-tenant.entity";
import {
  RegistrationEntity,
  RegistrationPaymentStatus,
  RegistrationStatus
} from "../modules/registrations/registration.entity";
import { TourEntity } from "../modules/tours/entities/tour.entity";
import { emitScriptInfo } from "./script-log";

const LEADER_EMAIL = "leader@test.com";
const SEED_NOTE = "seed:leader-bookings-table";

const DEFAULT_COUNT = 72;

const ACTIVE_STATUSES: RegistrationStatus[] = [
  RegistrationStatus.PENDING,
  RegistrationStatus.ACCEPTED,
  RegistrationStatus.ACCEPTED_PAID
];

const TERMINAL_STATUSES: RegistrationStatus[] = [
  RegistrationStatus.REJECTED,
  RegistrationStatus.CANCELLED,
  RegistrationStatus.NO_SHOW,
  RegistrationStatus.REFUNDED
];

async function run(): Promise<void> {
  const targetCount = Number.parseInt(process.env.SEED_LEADER_BOOKINGS_COUNT ?? String(DEFAULT_COUNT), 10);
  if (!Number.isFinite(targetCount) || targetCount < 1) {
    throw new Error("SEED_LEADER_BOOKINGS_COUNT must be a positive integer");
  }

  const dataSource = new DataSource({
    ...createDataSourceOptionsFromEnv(),
    entities: [UserEntity, UserTenantEntity, TourEntity, RegistrationEntity]
  });

  await dataSource.initialize();
  try {
    const userRepo = dataSource.getRepository(UserEntity);
    const membershipRepo = dataSource.getRepository(UserTenantEntity);
    const tourRepo = dataSource.getRepository(TourEntity);
    const regRepo = dataSource.getRepository(RegistrationEntity);

    const leader = await userRepo.findOne({
      where: { email: LEADER_EMAIL, deletedAt: IsNull() }
    });
    if (!leader) {
      throw new Error(`User not found: ${LEADER_EMAIL}. Run pnpm seed first.`);
    }

    const membership = await membershipRepo.findOne({
      where: { userId: leader.id, deletedAt: IsNull() }
    });
    if (!membership) {
      throw new Error(`No tenant membership for ${LEADER_EMAIL}.`);
    }

    const tenantId = membership.tenantId;
    const phone = syntheticBookingContactPhone(leader.id);

    const tours = await tourRepo.find({
      where: { tenantId, deletedAt: IsNull() },
      order: { createdAt: "ASC" }
    });
    if (tours.length === 0) {
      throw new Error("No tours for tenant. Run pnpm seed:demo-leader-tours first.");
    }

    const del = await regRepo
      .createQueryBuilder()
      .delete()
      .from(RegistrationEntity)
      .where("tenant_id = :tenantId", { tenantId })
      .andWhere("participant_contact_phone = :phone", { phone })
      .andWhere("participant_note = :note", { note: SEED_NOTE })
      .execute();
    emitScriptInfo(`Removed ${del.affected ?? 0} prior seeded booking row(s).`);

    /** Per tour: first row active (Pending/Accepted/AcceptedPaid); further rows terminal — matches duplicate rules for same phone. */
    const nthForTour = new Map<string, number>();

    const rows: RegistrationEntity[] = [];
    for (let i = 0; i < targetCount; i++) {
      const tour = tours[i % tours.length]!;
      const k = (nthForTour.get(tour.id) ?? 0) + 1;
      nthForTour.set(tour.id, k);

      const status: RegistrationStatus =
        k === 1 ? ACTIVE_STATUSES[i % ACTIVE_STATUSES.length]! : TERMINAL_STATUSES[i % TERMINAL_STATUSES.length]!;

      let paymentStatus: RegistrationPaymentStatus;
      switch (status) {
        case RegistrationStatus.PENDING:
          paymentStatus = RegistrationPaymentStatus.NOT_PAID;
          break;
        case RegistrationStatus.ACCEPTED:
          paymentStatus = i % 2 === 0 ? RegistrationPaymentStatus.NOT_PAID : RegistrationPaymentStatus.PARTIAL;
          break;
        case RegistrationStatus.ACCEPTED_PAID:
          paymentStatus = RegistrationPaymentStatus.PAID;
          break;
        case RegistrationStatus.REFUNDED:
          paymentStatus = RegistrationPaymentStatus.REFUNDED;
          break;
        default:
          paymentStatus = RegistrationPaymentStatus.NOT_PAID;
      }

      rows.push(
        regRepo.create({
          tenantId,
          tourId: tour.id,
          participantFullName: `دمو بوکینگ ${i + 1}`,
          participantContactPhone: phone,
          transportMode: "group_vehicle",
          entryMode: "web",
          participantNote: SEED_NOTE,
          status,
          paymentStatus,
          paidAmount:
            paymentStatus === RegistrationPaymentStatus.PAID ||
            paymentStatus === RegistrationPaymentStatus.PARTIAL
              ? "250000"
              : undefined
        })
      );
    }

    await regRepo.save(rows);
    emitScriptInfo(
      `✅ Inserted ${rows.length} registrations for ${LEADER_EMAIL} (phone ${phone}, tenant ${tenantId}). Open /bookings after login.`
    );
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error("seed-leader-bookings failed:", message);
  process.exitCode = 1;
});
