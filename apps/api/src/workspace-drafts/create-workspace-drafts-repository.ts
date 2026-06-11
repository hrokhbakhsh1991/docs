import {
  assertProductionStorageDriver,
  resolveStorageDriver,
} from "../storage/production-storage-driver-assert";
import {
  InMemoryWorkspaceDraftsRepository,
  resetWorkspaceDraftsRepositoryForTests,
  type WorkspaceDraftsRepository,
} from "./in-memory-workspace-drafts.repository";
import { PrismaWorkspaceDraftsRepository } from "./prisma-workspace-drafts.repository";

let singleton: WorkspaceDraftsRepository | null = null;

export function getWorkspaceDraftsRepository(): WorkspaceDraftsRepository {
  assertProductionStorageDriver();

  if (singleton === null) {
    if (resolveStorageDriver() === "prisma") {
      if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL.length === 0) {
        throw new Error("STORAGE_DRIVER=prisma requires DATABASE_URL for workspace drafts repository");
      }
      singleton = new PrismaWorkspaceDraftsRepository();
    } else {
      singleton = new InMemoryWorkspaceDraftsRepository();
    }
  }
  return singleton;
}

export function resetWorkspaceDraftsRepositorySingletonForTests(): void {
  resetWorkspaceDraftsRepositoryForTests();
  singleton = null;
}
