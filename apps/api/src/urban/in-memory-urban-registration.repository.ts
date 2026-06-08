import { randomUUID } from "node:crypto";

export type UrbanRegistrationRecord = {
  readonly id: string;
  readonly tenantId: string;
  readonly tourId: string;
  readonly email: string;
  readonly fullName: string;
  readonly phone: string | null;
  readonly partySize: number | null;
  readonly notes: string | null;
  readonly status: "waitlist" | "confirmed" | "cancelled";
  readonly createdAt: string;
};

export type CreateUrbanRegistrationInput = {
  readonly tenantId: string;
  readonly tourId: string;
  readonly email: string;
  readonly fullName: string;
  readonly phone?: string;
  readonly partySize?: number;
  readonly notes?: string;
};

export interface UrbanRegistrationRepository {
  findByTenantTourEmail(
    tenantId: string,
    tourId: string,
    email: string
  ): Promise<UrbanRegistrationRecord | null>;
  create(input: CreateUrbanRegistrationInput): Promise<UrbanRegistrationRecord>;
  clear(): void;
}

export class InMemoryUrbanRegistrationRepository implements UrbanRegistrationRepository {
  private readonly rows = new Map<string, UrbanRegistrationRecord>();

  private key(tenantId: string, tourId: string, email: string): string {
    return `${tenantId}:${tourId}:${email.trim().toLowerCase()}`;
  }

  async findByTenantTourEmail(
    tenantId: string,
    tourId: string,
    email: string
  ): Promise<UrbanRegistrationRecord | null> {
    return this.rows.get(this.key(tenantId, tourId, email)) ?? null;
  }

  async create(input: CreateUrbanRegistrationInput): Promise<UrbanRegistrationRecord> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await this.findByTenantTourEmail(
      input.tenantId,
      input.tourId,
      normalizedEmail
    );
    if (existing !== null) {
      return existing;
    }
    const record: UrbanRegistrationRecord = {
      id: randomUUID(),
      tenantId: input.tenantId,
      tourId: input.tourId,
      email: normalizedEmail,
      fullName: input.fullName.trim(),
      phone: input.phone?.trim() ?? null,
      partySize: input.partySize ?? null,
      notes: input.notes?.trim() ?? null,
      status: "waitlist",
      createdAt: new Date().toISOString(),
    };
    this.rows.set(this.key(input.tenantId, input.tourId, normalizedEmail), record);
    return record;
  }

  clear(): void {
    this.rows.clear();
  }
}

let repositorySingleton: InMemoryUrbanRegistrationRepository | null = null;

export function getUrbanRegistrationRepository(): UrbanRegistrationRepository {
  repositorySingleton ??= new InMemoryUrbanRegistrationRepository();
  return repositorySingleton;
}

export function resetUrbanRegistrationRepositoryForTests(): void {
  if (repositorySingleton !== null) {
    repositorySingleton.clear();
  }
}
