/** Minimal tour context for registration pricing quotes (no tours-module entity import). */
export type RegistrationQuoteTourContext = {
  id: string;
  tenantId: string;
  tourDepartureId?: string | null;
};
