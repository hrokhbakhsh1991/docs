"use client";

import { Input } from "@app-tour/ui-primitives/input";
import { useId } from "react";
import { useTranslations } from "next-intl";

import { USERS_DIRECTORY_TEST_IDS } from "@/features/users/users-directory-types";
import { type LoyaltyTier } from "@/features/users/users-rewards-logic";
import { cn } from "@/lib/utils";

const LOYALTY_RADIO_CLASS =
  "mt-0.5 size-4 shrink-0 !min-h-0 !w-4 !p-0 !border-0 !bg-transparent cursor-pointer accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50";

type UsersLoyaltyTierSelectorProps = {
  readonly value: LoyaltyTier;
  readonly disabled?: boolean;
  readonly onChange: (value: LoyaltyTier) => void;
};

type LoyaltyOption = {
  readonly value: LoyaltyTier;
  readonly titleKey: "rewards.loyaltyNone" | "rewards.loyaltyVip" | "rewards.loyaltyGold";
  readonly descriptionKey:
    | "rewards.loyaltyNoneDescription"
    | "rewards.loyaltyVipDescription"
    | "rewards.loyaltyGoldDescription";
};

const LOYALTY_OPTIONS: readonly LoyaltyOption[] = [
  { value: "none", titleKey: "rewards.loyaltyNone", descriptionKey: "rewards.loyaltyNoneDescription" },
  {
    value: "VIP_MEMBER",
    titleKey: "rewards.loyaltyVip",
    descriptionKey: "rewards.loyaltyVipDescription",
  },
  {
    value: "GOLD_CLUB",
    titleKey: "rewards.loyaltyGold",
    descriptionKey: "rewards.loyaltyGoldDescription",
  },
] as const;

export function UsersLoyaltyTierSelector({
  value,
  disabled = false,
  onChange,
}: UsersLoyaltyTierSelectorProps) {
  const t = useTranslations("users");
  const groupId = useId();
  const legendId = `${groupId}-legend`;

  return (
    <fieldset
      role="radiogroup"
      aria-labelledby={legendId}
      disabled={disabled}
      className="space-y-2"
      data-testid={USERS_DIRECTORY_TEST_IDS.rewardsLoyaltyTier}
    >
      <legend id={legendId} className="mb-1 block w-full text-sm font-medium leading-5">
        {t("rewards.loyaltyTierLabel")}
      </legend>
      <div className="space-y-2">
        {LOYALTY_OPTIONS.map((option) => {
          const inputId = `${groupId}-${option.value}`;
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              htmlFor={inputId}
              className={cn(
                "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border/60 bg-background hover:bg-muted/30",
                disabled && "cursor-not-allowed opacity-60"
              )}
            >
              <Input
                id={inputId}
                type="radio"
                name="member-benefits-loyalty-tier"
                className={LOYALTY_RADIO_CLASS}
                value={option.value}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(option.value)}
              />
              <span className="min-w-0 flex-1 text-start">
                <span className="block text-sm font-medium leading-5">{t(option.titleKey)}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                  {t(option.descriptionKey)}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
