import {
  initialPublicRegistrationOtp,
  initialPublicRegistrationPhone,
  resolveIntakeDefaults,
} from "@app-tour/catalog-registration-auth";
import type {
  FlowRuntimeState,
  PublicCatalogTransportIntakeState,
  RegistrationFlowContext,
} from "@app-tour/workspace-sdk";

import { readPublicCatalogSessionFromCookies } from "@/auth/read-public-catalog-session.server";
import { fetchMemberProfileFromSession } from "@/me/fetch-member-profile-from-session.server";
import { sessionMemberMatchesPortalGuestSurface } from "@/tenant/session-host-binding";

function emptyTransportState(): PublicCatalogTransportIntakeState {
  return {
    optInPersonalCar: false,
    hasPersonalCar: null,
    personalCarOccupants: null,
    paysDong: null,
  };
}

export type RegistrationResumeInitialState = Readonly<{
  initialState: FlowRuntimeState;
  memberMobile: string | null;
}>;

/** Server-only — resume catalog registration at intake when member session is valid. */
export async function buildRegistrationResumeInitialState(
  host: string,
  portalTenantId: string,
  _context: RegistrationFlowContext
): Promise<RegistrationResumeInitialState | null> {
  const session = await readPublicCatalogSessionFromCookies();
  if (
    session === null ||
    !sessionMemberMatchesPortalGuestSurface(session.tenantId, host, portalTenantId)
  ) {
    return null;
  }

  const profilePayload = await fetchMemberProfileFromSession(host, portalTenantId);
  if (profilePayload === null) {
    return null;
  }

  const fields = profilePayload.profile.fields ?? {};
  const sessionDisplayName =
    (typeof fields.displayName === "string" ? fields.displayName : "") ||
    (typeof fields.mobile === "string" ? fields.mobile : "");
  const sessionEmailValue = typeof fields.email === "string" ? fields.email : null;
  const sessionNationalIdValue = typeof fields.nationalId === "string" ? fields.nationalId : null;
  const sessionFatherNameValue = typeof fields.fatherName === "string" ? fields.fatherName : null;
  const sessionBirthDateValue = typeof fields.birthDate === "string" ? fields.birthDate : null;

  const defaults = resolveIntakeDefaults({
    profileDisplayName: sessionDisplayName,
    sessionDisplayName,
    sessionNationalId: sessionNationalIdValue,
    sessionFatherName: sessionFatherNameValue,
    sessionBirthDate: sessionBirthDateValue,
    registrantTarget: "self",
  });
  const resolvedEmail = sessionEmailValue?.trim() ?? "";
  const memberMobile =
    typeof fields.mobile === "string" && fields.mobile.trim().length > 0
      ? fields.mobile.trim()
      : null;

  return Object.freeze({
    memberMobile,
    initialState: Object.freeze({
      currentStep: "intake",
      data: Object.freeze({
      phone: memberMobile ?? initialPublicRegistrationPhone(),
      otp: initialPublicRegistrationOtp(),
      challengeId: "",
      onboardingToken: "",
      displayName: sessionDisplayName,
      profileEmail: resolvedEmail,
      sessionEmail: resolvedEmail,
      sessionNationalId: defaults.nationalId,
      sessionFatherName: defaults.fatherName,
      sessionBirthDate: defaults.birthDate,
      savedSelfIntakeDefaults: defaults,
      intakeName: defaults.name,
      intakeNationalId: defaults.nationalId,
      intakeFatherName: defaults.fatherName,
      intakeBirthDate: defaults.birthDate,
      intakeEmail: resolvedEmail,
      intakePhone: "",
      partySize: "1",
      notes: "",
      registrantTarget: "self",
      transportState: emptyTransportState(),
      }),
    }),
  });
}
