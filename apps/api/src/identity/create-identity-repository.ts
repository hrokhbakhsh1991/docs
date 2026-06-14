import {
  assertProductionStorageDriver,
  resolveStorageDriver,
} from "../storage/production-storage-driver-assert";
import {
  InMemoryIdentityRepository,
  type IdentityRepository,
} from "./in-memory-identity.repository";

export type { IdentityRepository } from "./in-memory-identity.repository";
import { PrismaIdentityRepository } from "./prisma-identity.repository";

let singleton: IdentityRepository | null = null;
let singletonDriver: ReturnType<typeof resolveStorageDriver> | null = null;

/**
 * DI factory — follows `STORAGE_DRIVER=memory|prisma` (same as tour storage).
 * Production refuses memory driver before constructing a repository.
 */
export function getIdentityRepository(): IdentityRepository {
  assertProductionStorageDriver();

  // Test harness pins an in-memory repo while gate env exports STORAGE_DRIVER=prisma.
  if (singleton instanceof InMemoryIdentityRepository && singletonDriver === "memory") {
    return singleton;
  }

  const driver = resolveStorageDriver();
  if (singleton !== null && singletonDriver === driver) {
    return singleton;
  }

  if (driver === "prisma") {
    if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL.length === 0) {
      throw new Error("STORAGE_DRIVER=prisma requires DATABASE_URL for identity repository");
    }
    singleton = new PrismaIdentityRepository();
  } else {
    singleton = InMemoryIdentityRepository.createWithDevSeed();
  }
  singletonDriver = driver;
  return singleton;
}

/** Tests only — returns a fresh in-memory repository (sync seed helpers). */
export function resetIdentityRepositoryForTests(): InMemoryIdentityRepository {
  const repo = new InMemoryIdentityRepository();
  singleton = repo;
  singletonDriver = "memory";
  return repo;
}

export function resetIdentityRepositorySingletonForTests(): void {
  singleton = null;
  singletonDriver = null;
}
