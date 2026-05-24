"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";

import type {
  BookingDto,
  RegistrationPaymentStatus,
  RegistrationStatus,
  WaitlistItemResponseDto,
} from "@repo/types";

import type { TourDetailDto } from "@/lib/services/tours.service";

export type TourWorkspaceContextValue = {
  tourId: string;
  tour: TourDetailDto;
  readOnly: boolean;
  registrations: BookingDto[];
  waitlist: WaitlistItemResponseDto[];
  regLoading: boolean;
  regIsError: boolean;
  refetchRegistrations: () => void;
  waitLoading: boolean;
  waitIsError: boolean;
  refetchWaitlist: () => void;
  statusMutation: UseMutationResult<
    BookingDto,
    Error,
    { id: string; targetStatus: RegistrationStatus; expected_row_version: number }
  >;
  paymentMutation: UseMutationResult<
    BookingDto,
    Error,
    {
      id: string;
      paymentStatus: RegistrationPaymentStatus;
      paidAmount?: number;
      expected_row_version: number;
    }
  >;
  convertMutation: UseMutationResult<WaitlistItemResponseDto, Error, string>;
};

const TourWorkspaceContext = createContext<TourWorkspaceContextValue | null>(null);

export function TourWorkspaceProvider({
  value,
  children,
}: {
  value: TourWorkspaceContextValue;
  children: ReactNode;
}) {
  return <TourWorkspaceContext.Provider value={value}>{children}</TourWorkspaceContext.Provider>;
}

export function useTourWorkspace(): TourWorkspaceContextValue {
  const ctx = useContext(TourWorkspaceContext);
  if (ctx == null) {
    throw new Error("useTourWorkspace must be used within TourWorkspaceProvider");
  }
  return ctx;
}
