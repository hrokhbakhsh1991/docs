import { resolveIntakeDefaults } from "@app-tour/catalog-registration-auth";
import {
  mergeFlowState,
  transitionFlowStep,
  type FlowRuntimeState,
  type RegistrationFlowDispatch,
  type RegistrationFlowContext,
} from "@app-tour/workspace-sdk";

import { resolveCatalogRegistrationTransportInitialState } from "./transport-initializer-registry";

export async function hydrateCatalogRegistrationIntakeAfterSession(
  context: RegistrationFlowContext,
  state: FlowRuntimeState,
  dispatch: RegistrationFlowDispatch,
  profileDisplayName = "",
  profileEmailValue = ""
): Promise<void> {
  let sessionDisplayName = "";
  let sessionEmailValue: string | null = null;
  let sessionNationalIdValue: string | null = null;
  let sessionFatherNameValue: string | null = null;
  let sessionBirthDateValue: string | null = null;
  let sessionMobileValue: string | null = null;
  try {
    const res = await fetch("/api/me/profile", {
      credentials: "include",
      cache: "no-store",
    });
    const profile = (await res.json()) as {
      ok?: boolean;
      profile?: { fields?: Record<string, string | null> };
    };
    if (res.ok && profile.ok === true && profile.profile !== undefined) {
      const fields = profile.profile.fields ?? {};
      sessionDisplayName =
        (typeof fields.displayName === "string" ? fields.displayName : "") ||
        (typeof fields.mobile === "string" ? fields.mobile : "");
      sessionEmailValue = typeof fields.email === "string" ? fields.email : null;
      sessionNationalIdValue = typeof fields.nationalId === "string" ? fields.nationalId : null;
      sessionFatherNameValue = typeof fields.fatherName === "string" ? fields.fatherName : null;
      sessionBirthDateValue = typeof fields.birthDate === "string" ? fields.birthDate : null;
      sessionMobileValue =
        typeof fields.mobile === "string" && fields.mobile.trim().length > 0
          ? fields.mobile.trim()
          : null;
    }
  } catch {
    // profile optional
  }
  const defaults = resolveIntakeDefaults({
    profileDisplayName,
    sessionDisplayName,
    sessionNationalId: sessionNationalIdValue,
    sessionFatherName: sessionFatherNameValue,
    sessionBirthDate: sessionBirthDateValue,
    registrantTarget: "self",
  });
  const resolvedEmail =
    profileEmailValue.trim().length > 0
      ? profileEmailValue.trim()
      : (sessionEmailValue?.trim() ?? "");
  const resolvedPhone =
    sessionMobileValue !== null && sessionMobileValue.length > 0
      ? sessionMobileValue
      : state.data.phone;
  mergeFlowState(state, dispatch, {
    phone: resolvedPhone,
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
    transportState: resolveCatalogRegistrationTransportInitialState(context),
  });
  transitionFlowStep(dispatch, "intake");
}
