/** Tour + workspace rules that tighten registration intake validation. */
export type RegistrationFieldPolicy = {
  nationalIdRequired: boolean;
  profileNationalIdPresent: boolean;
  sportsInsuranceRequired: boolean;
  requirePeakHistory: boolean;
  allowPrivateCar: boolean;
};
