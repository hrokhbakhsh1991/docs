export type {
  BookingTarget,
  RegistrationFieldPolicy,
  RegistrationIntakeValues,
  RegistrationPrefillSource,
} from "./types";

export {
  buildRegistrationIntakeCoreSchema,
  buildRegistrationIntakeSchema,
  TransportSchema,
  type RegistrationIntakeCoreFormValues,
  type RegistrationIntakeFormValues,
  type RegistrationIntakeSchemaMessages,
} from "./buildRegistrationIntakeSchema";

export {
  guestIntakeDefaults,
  intakeDefaultsForTarget,
  selfIntakeFromProfile,
} from "./mapMeToIntakePrefill";

export {
  useRegistrationBookingTarget,
  type UseRegistrationBookingTargetInput,
} from "./useRegistrationBookingTarget";
