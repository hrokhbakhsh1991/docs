import {
  assertProductionStorageDriver,
  resolveStorageDriver,
} from "../storage/production-storage-driver-assert";
import {
  InMemoryWorkspaceDraftEventsRepository,
  resetWorkspaceDraftEventsRepositoryForTests,
  type WorkspaceDraftEventsRepository,
} from "./in-memory-workspace-draft-events.repository";
import { PrismaWorkspaceDraftEventsRepository } from "./prisma-workspace-draft-events.repository";

let singleton: WorkspaceDraftEventsRepository | null = null;

export function getWorkspaceDraftEventsRepository(): WorkspaceDraftEventsRepository {
  assertProductionStorageDriver();

  if (singleton === null) {
    if (resolveStorageDriver() === "prisma") {
      if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL.length === 0) {
        throw new Error(
          "STORAGE_DRIVER=prisma requires DATABASE_URL for workspace draft events repository"
        );
      }
      singleton = new PrismaWorkspaceDraftEventsRepository();
    } else {
      singleton = new InMemoryWorkspaceDraftEventsRepository();
    }
  }
  return singleton;
}

export function resetWorkspaceDraftEventsRepositorySingletonForTests(): void {
  resetWorkspaceDraftEventsRepositoryForTests();
  singleton = null;
}
