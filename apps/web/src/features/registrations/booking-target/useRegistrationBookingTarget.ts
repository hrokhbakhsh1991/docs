"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Resolver } from "react-hook-form";
import { useForm } from "react-hook-form";

import type { MeProfileWire } from "@repo/types";
import { useAuthBffQueryGateForTenant } from "@/hooks/use-auth-bff-query-gate";
import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-scope";
import { fetchMe } from "@/lib/me-client";

import {
  buildRegistrationIntakeSchema,
  type RegistrationIntakeFormValues,
  type RegistrationIntakeSchemaMessages,
} from "./buildRegistrationIntakeSchema";
import { guestIntakeDefaults, intakeDefaultsForTarget, selfIntakeFromProfile } from "./mapMeToIntakePrefill";
import type { BookingTarget, RegistrationFieldPolicy } from "./types";

export type UseRegistrationBookingTargetInput = {
  enabled: boolean;
  policy: RegistrationFieldPolicy;
  messages: RegistrationIntakeSchemaMessages;
  /** Called when user switches target so parent can clear mutation state if needed. */
  onTargetChange?: (_target: BookingTarget) => void;
};

export function useRegistrationBookingTarget(input: UseRegistrationBookingTargetInput) {
  const tenantId = useWorkspaceQueryScope();
  const { authBffQueryEnabled } = useAuthBffQueryGateForTenant(tenantId);
  const [bookingTarget, setBookingTargetState] = useState<BookingTarget>("self");

  const policyRef = useRef(input.policy);
  policyRef.current = input.policy;
  const messagesRef = useRef(input.messages);
  messagesRef.current = input.messages;

  const resolver = useCallback<Resolver<RegistrationIntakeFormValues>>(
    (values, context, options) =>
      zodResolver(buildRegistrationIntakeSchema(policyRef.current, messagesRef.current))(
        values,
        context,
        options,
      ),
    [],
  );

  const meQuery = useQuery({
    queryKey: ["me", tenantId ?? "", "registration-intake"],
    enabled: input.enabled && authBffQueryEnabled,
    queryFn: async (): Promise<MeProfileWire> => {
      const res = await fetchMe();
      const body = (await res.json()) as MeProfileWire;
      if (!res.ok) {
        throw new Error(`me ${res.status}`);
      }
      return body;
    },
    staleTime: 30_000,
  });

  const form = useForm<RegistrationIntakeFormValues>({
    resolver,
    defaultValues: guestIntakeDefaults(),
    mode: "onChange",
  });

  const { reset, trigger } = form;

  const applyTarget = useCallback(
    (target: BookingTarget, me: MeProfileWire | undefined) => {
      const defaults = intakeDefaultsForTarget(target, me);
      reset(defaults, { keepDefaultValues: false });
      setBookingTargetState(target);
      input.onTargetChange?.(target);
    },
    [input, reset],
  );

  const setBookingTarget = useCallback(
    (target: BookingTarget) => {
      applyTarget(target, meQuery.data);
    },
    [applyTarget, meQuery.data],
  );

  // Initial self prefill once profile loads (default target = self).
  useEffect(() => {
    if (bookingTarget !== "self" || !meQuery.isSuccess) {
      return;
    }
    reset(selfIntakeFromProfile(meQuery.data), { keepDefaultValues: false });
  }, [bookingTarget, meQuery.isSuccess, meQuery.data, reset]);

  // Re-validate when tour policy flags change after the tour detail query resolves.
  const profileNationalIdPresent = (meQuery.data?.national_id ?? "").trim() !== "";

  const policyWithProfile = useMemo(
    (): RegistrationFieldPolicy => ({
      ...input.policy,
      profileNationalIdPresent,
    }),
    [input.policy, profileNationalIdPresent],
  );

  policyRef.current = policyWithProfile;

  const policySignature = useMemo(
    () =>
      `${policyWithProfile.nationalIdRequired}:${policyWithProfile.profileNationalIdPresent}:${policyWithProfile.requirePeakHistory}`,
    [
      policyWithProfile.nationalIdRequired,
      policyWithProfile.profileNationalIdPresent,
      policyWithProfile.requirePeakHistory,
    ],
  );
  useEffect(() => {
    void trigger();
  }, [policySignature, trigger]);

  const profileNationalId = (meQuery.data?.national_id ?? "").trim();

  const profileFetchBlocksSubmit =
    bookingTarget === "self" && (meQuery.isLoading || meQuery.isError);

  const submitBlocked = profileFetchBlocksSubmit;

  const showGuestNationalIdField =
    bookingTarget === "guest" && input.policy.nationalIdRequired;

  const showSelfNationalIdField =
    bookingTarget === "self" &&
    input.policy.nationalIdRequired &&
    meQuery.isSuccess &&
    !profileNationalIdPresent;

  const showSelfNationalIdReadOnly =
    bookingTarget === "self" &&
    input.policy.nationalIdRequired &&
    meQuery.isSuccess &&
    profileNationalIdPresent;

  const lockSelfIdentityFields =
    bookingTarget === "self" &&
    Boolean(meQuery.data?.full_name?.trim()) &&
    Boolean(meQuery.data?.phone?.trim());

  return {
    bookingTarget,
    setBookingTarget,
    form,
    meQuery,
    submitBlocked,
    profileNationalIdPresent,
    profileNationalId,
    showGuestNationalIdField,
    showSelfNationalIdField,
    showSelfNationalIdReadOnly,
    lockSelfIdentityFields,
  };
}
