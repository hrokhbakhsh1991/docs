import { z } from "zod";

import { PUBLIC_CATALOG_REGISTRATION_TRANSPORT_KINDS } from "@app-tour/workspace-sdk";

export const denaliRegistrationTransportKindSchema = z.enum(
  PUBLIC_CATALOG_REGISTRATION_TRANSPORT_KINDS
);

export const denaliRegistrationTransportIntakeSchema = z.object({
  kind: denaliRegistrationTransportKindSchema,
  personalCarOccupants: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
});

export type DenaliRegistrationTransportKind = z.infer<typeof denaliRegistrationTransportKindSchema>;
export type DenaliRegistrationTransportIntake = z.infer<
  typeof denaliRegistrationTransportIntakeSchema
>;

export const denaliRegistrantTargetSchema = z.enum(["self", "other"]);

export type DenaliRegistrantTarget = z.infer<typeof denaliRegistrantTargetSchema>;
