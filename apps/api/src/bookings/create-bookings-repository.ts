import {
  assertProductionStorageDriver,
  resolveStorageDriver,
} from "../storage/production-storage-driver-assert";
import {
  InMemoryBookingsRepository,
  resetBookingsStoresForTests,
  type BookingsRepository,
} from "./in-memory-bookings.repository";
import { PrismaBookingsRepository } from "./prisma-bookings.repository";

let singleton: BookingsRepository | null = null;
let singletonDriver: ReturnType<typeof resolveStorageDriver> | null = null;

export function getBookingsRepository(): BookingsRepository {
  assertProductionStorageDriver();

  const driver = resolveStorageDriver();
  if (singleton !== null && singletonDriver === driver) {
    return singleton;
  }

  if (driver === "prisma") {
    if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL.length === 0) {
      throw new Error("STORAGE_DRIVER=prisma requires DATABASE_URL for bookings repository");
    }
    singleton = new PrismaBookingsRepository();
  } else {
    singleton = InMemoryBookingsRepository.createWithDevSeed();
  }
  singletonDriver = driver;
  return singleton;
}

export function resetBookingsRepositoryForTests(): InMemoryBookingsRepository {
  resetBookingsStoresForTests();
  singleton = new InMemoryBookingsRepository();
  return singleton;
}

export function resetBookingsRepositorySingletonForTests(): void {
  singleton = null;
  singletonDriver = null;
}
