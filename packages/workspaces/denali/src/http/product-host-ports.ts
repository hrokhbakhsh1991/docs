import type { IncomingMessage } from "node:http";
import type { WorkspaceProductHttpHostBasePorts } from "@app-tour/workspace-sdk";

import type { BookingPublicPort } from "./ports/public-booking.port";
import type { DenaliPublicDestinationPort } from "./ports/public-destination.port";
import type { DenaliExposureResolverPort } from "./ports/exposure-resolver.port";
import type { DenaliReminderFeedPort } from "./ports/reminder-feed.port";
import type { RegistrationCommercialPricingPort } from "./ports/registration-commercial-pricing.port";
import type { DenaliTourStorePort } from "./ports/tour-store.port";

export type DenaliProductRouteDeps = {
  readonly tourStore?: unknown;
  readonly publicBookingPort?: BookingPublicPort;
  readonly publicDestinationPort?: DenaliPublicDestinationPort;
  readonly exposureResolverPort?: DenaliExposureResolverPort;
  readonly reminderFeedPort?: DenaliReminderFeedPort;
  readonly registrationCommercialPricingPort?: RegistrationCommercialPricingPort;
  readonly resolveGuestMembership?: (
    tenantId: string,
    userId: string
  ) => Promise<{
    readonly displayName?: string | null;
    readonly nationalId?: string | null;
    readonly fatherName?: string | null;
    readonly birthDate?: string | null;
  } | null>;
  readonly saveGuestProfileFields?: (
    tenantId: string,
    userId: string,
    patch: {
      readonly displayName?: string;
      readonly nationalId?: string;
      readonly fatherName?: string;
      readonly birthDate?: string;
    }
  ) => Promise<void>;
};

export type DenaliProductHttpHostPorts = WorkspaceProductHttpHostBasePorts & {
  readonly resolveTourStore: (deps: DenaliProductRouteDeps) => Promise<DenaliTourStorePort>;
  readonly readDenaliRegistrationRequestBody: (req: IncomingMessage) => Promise<unknown>;
  readonly resolvePublicBookingPort: (deps: DenaliProductRouteDeps) => BookingPublicPort;
  readonly resolvePublicDestinationPort: (
    deps: DenaliProductRouteDeps
  ) => DenaliPublicDestinationPort | undefined;
  readonly resolveExposureResolverPort: (
    deps: DenaliProductRouteDeps
  ) => DenaliExposureResolverPort | undefined;
  readonly resolveReminderFeedPort: (
    deps: DenaliProductRouteDeps
  ) => DenaliReminderFeedPort | undefined;
  readonly resolveRegistrationCommercialPricingPort: (
    deps: DenaliProductRouteDeps
  ) => RegistrationCommercialPricingPort;
};
