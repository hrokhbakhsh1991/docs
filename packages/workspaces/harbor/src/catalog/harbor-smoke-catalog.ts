import type {
  WorkspaceGuestSmokeCatalogPort,
  WorkspaceGuestSmokeRegistrationInput,
  WorkspaceGuestSmokeRegistrationResult,
} from "@app-tour/workspace-sdk";
import type { PublicCatalogCard } from "@app-tour/workspace-sdk";
import { createClientSafeUuid } from "@app-tour/draft-engine";

import { buildHarborEventJsonLd } from "./build-harbor-event-jsonld";

/** DG-4.1/4.2 smoke — published harbor catalog tour (city G1). */
export const HARBOR_SMOKE_PUBLISHED_TOUR_ID =
  "00000000-0000-4000-8000-000000000521" as const;

export const HARBOR_SMOKE_PUBLISHED_TOUR_TITLE = "Harbor evening sail" as const;

/** City key used by smoke `?city=` filter (DG-4.2). */
export const HARBOR_SMOKE_PUBLISHED_TOUR_CITY = "bandar" as const;

const HARBOR_SMOKE_CATALOG_UPDATED_AT = "2026-07-31T12:00:00.000Z" as const;

export type HarborSmokeCatalogCard = PublicCatalogCard & {
  readonly city: string;
};

export function buildHarborSmokeCatalogCard(): HarborSmokeCatalogCard {
  const card: PublicCatalogCard = Object.freeze({
    id: HARBOR_SMOKE_PUBLISHED_TOUR_ID,
    title: HARBOR_SMOKE_PUBLISHED_TOUR_TITLE,
    shortDescription: "Harbor smoke catalog waterfront event",
    category: "city_sail",
    departureAt: "2026-09-12T17:00:00.000Z",
    endAt: "2026-09-12T21:00:00.000Z",
    priceAmount: 850_000,
    priceCurrency: "IRR",
    coverImageUrl: null,
    totalCapacity: 18,
    catalogUpdatedAt: HARBOR_SMOKE_CATALOG_UPDATED_AT,
    listSubtitle: HARBOR_SMOKE_PUBLISHED_TOUR_CITY,
    policiesText: "Harbor smoke cancellation: free until 24h before departure.",
    cancellationDeadlineHours: 24,
    cancellationPenaltyPercentage: 50,
  });

  return Object.freeze({
    ...card,
    city: HARBOR_SMOKE_PUBLISHED_TOUR_CITY,
    structuredData: buildHarborEventJsonLd(card) as unknown as Readonly<
      Record<string, unknown>
    >,
  });
}

type HarborSmokeRegistrationRecord = WorkspaceGuestSmokeRegistrationResult & {
  readonly fullName: string;
  readonly email: string | null;
  readonly partySize: number;
  readonly createdAt: string;
};

function newRegistrationId(): string {
  return createClientSafeUuid();
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
