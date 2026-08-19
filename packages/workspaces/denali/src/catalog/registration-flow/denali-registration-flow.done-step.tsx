"use client";

import React from "react";
void React;
import { useLocale, useTranslations } from "next-intl";

import type { RegistrationFlowStepProps } from "@app-tour/workspace-sdk";

import { denaliCatalogRegistrationFlowSurface } from "./denali-registration-flow.surface";

export function DenaliDoneStep({ context, state }: RegistrationFlowStepProps) {
  const t = useTranslations("catalogRegistration");
  const locale = useLocale();
  const attrs =
    denaliCatalogRegistrationFlowSurface.successDataAttributes?.(state, context) ?? {};

  return (
    <div
      data-public-registration-success
      data-denali-registration-ledger
      {...attrs}
      dir={locale === "fa" ? "rtl" : "ltr"}
    >
      <p data-denali-success-kicker>{t("intake.kicker")}</p>
      <h1 data-denali-success-title>{t("success.title")}</h1>
      <p data-denali-success-tour role="status">
        {t("success.message", { tourTitle: context.tourTitle })}
      </p>
      <div data-denali-success-actions>
        {context.memberModuleHref !== null ? (
          <p>
            <a data-denali-success-primary href={context.memberModuleHref}>
              {t("success.viewRegistrations")}
            </a>
          </p>
        ) : null}
        <p>
          <a data-denali-success-secondary href={context.backHref}>
            {t("success.backToTour")}
          </a>
        </p>
      </div>
    </div>
  );
}

