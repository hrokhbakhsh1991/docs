import {
  assertProductionStorageDriver,
  resolveStorageDriver,
} from "../storage/production-storage-driver-assert";
import {
  InMemoryBookingsRepository,
  resetBookingsStoresForTests,
} from "./in-memory-bookings.repository";
import type { BookingRepositoryPort } from "./ports/booking-repository.port";
import { PrismaBookingsRepository } from "./prisma-bookings.repository";

export type { BookingRepositoryPort, BookingsRepository } from "./ports/booking-repository.port";

let singleton: BookingRepositoryPort | null = null;
let singletonDriver: ReturnType<typeof resolveStorageDriver> | null = null;

export function getBookingsRepository(): BookingRepositoryPort {
  assertProductionStorageDriver();

  const driver = resolveStorageDriver();

  // Test harness pins in-memory only while the active driver remains memory.
  if (
    driver === "memory" &&
    singleton instanceof InMemoryBookingsRepository &&
    singletonDriver === "memory"
  ) {
    return singleton;
  }

  if (singleton instanceof InMemoryBookingsRepository && singletonDriver === "memory" && driver === "prisma") {
    singleton = null;
    singletonDriver = null;
  }

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
  const repo = new InMemoryBookingsRepository();
  singleton = repo;
  singletonDriver = "memory";
  return repo;
}

export function resetBookingsRepositorySingletonForTests(): void {
  singleton = null;
  singletonDriver = null;
}
