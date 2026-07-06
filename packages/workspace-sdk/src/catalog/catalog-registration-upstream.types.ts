export type CatalogRegistrationPortalPayload = {
  readonly tourId: string;
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
  readonly partySize: number;
  readonly notes: string;
  readonly nationalId: string;
  readonly fatherName: string;
  readonly birthDate: string;
  readonly registrantTarget?: "self" | "other";
  readonly transport?: unknown;
};

export type CatalogRegistrationUpstreamRequest = {
  readonly path: string;
  readonly body: unknown;
  readonly extraHeaders?: Readonly<Record<string, string>>;
};
