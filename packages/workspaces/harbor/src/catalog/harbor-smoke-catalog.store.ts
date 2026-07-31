import type {
  WorkspaceGuestSmokeCatalogPort,
  WorkspaceGuestSmokeRegistrationInput,
  WorkspaceGuestSmokeRegistrationResult,
} from "@app-tour/workspace-sdk";

import {
  buildHarborSmokeCatalogCard,
  HARBOR_SMOKE_PUBLISHED_TOUR_ID,
  type HarborSmokeCatalogCard,
} from "./harbor-smoke-catalog.fixture";

type HarborSmokeRegistrationRecord = WorkspaceGuestSmokeRegistrationResult & {
  readonly fullName: string;
  readonly email: string | null;
  readonly partySize: number;
  readonly createdAt: string;
};

function newRegistrationId(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * Thin in-memory catalog/registration store for harbor G1 smoke (DG-4.6).
 * Not a Denali/Urban clone — seed stays fixture-driven; swap later via same port.
 */
export class HarborSmokeCatalogStore
  implements WorkspaceGuestSmokeCatalogPort<HarborSmokeCatalogCard>
{
  private readonly cards = new Map<string, HarborSmokeCatalogCard>();
  private readonly registrations: HarborSmokeRegistrationRecord[] = [];

  ensureSeedCard(): void {
    if (this.cards.has(HARBOR_SMOKE_PUBLISHED_TOUR_ID)) {
      return;
    }
    const card = buildHarborSmokeCatalogCard();
    this.cards.set(card.id, card);
  }

  listPublished(): readonly HarborSmokeCatalogCard[] {
    this.ensureSeedCard();
    return [...this.cards.values()];
  }

  getPublished(tourId: string): HarborSmokeCatalogCard | null {
    this.ensureSeedCard();
    return this.cards.get(tourId.trim()) ?? null;
  }

  createRegistration(
    input: WorkspaceGuestSmokeRegistrationInput,
  ): WorkspaceGuestSmokeRegistrationResult {
    this.ensureSeedCard();
    const record: HarborSmokeRegistrationRecord = {
      id: newRegistrationId(),
      tourId: input.tourId,
      status: "pending",
      fullName: input.fullName,
      email: input.email,
      partySize: input.partySize,
      createdAt: new Date().toISOString(),
    };
    this.registrations.push(record);
    return {
      id: record.id,
      tourId: record.tourId,
      status: record.status,
    };
  }

  listRegistrations(): readonly HarborSmokeRegistrationRecord[] {
    return [...this.registrations];
  }

  clear(): void {
    this.cards.clear();
    this.registrations.length = 0;
  }
}

let storeSingleton: HarborSmokeCatalogStore | null = null;

export function getHarborSmokeCatalogStore(): HarborSmokeCatalogStore {
  storeSingleton ??= new HarborSmokeCatalogStore();
  return storeSingleton;
}

export function resetHarborSmokeCatalogStoreForTests(): void {
  storeSingleton?.clear();
  storeSingleton = null;
}
