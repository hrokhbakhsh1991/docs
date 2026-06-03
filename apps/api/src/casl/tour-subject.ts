import { subject } from "@casl/ability";

export type TourSubject = {
  readonly tenantId: string;
  readonly tourId?: string;
};

export function tourSubject(params: TourSubject) {
  return subject("Tour", params);
}
