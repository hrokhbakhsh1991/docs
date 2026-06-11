"use client";

import { useTranslations } from "next-intl";

type OperatorStubPageProps = {
  readonly title: string;
  readonly subphase: string;
};

export function OperatorStubPage({ title, subphase }: OperatorStubPageProps) {
  const t = useTranslations("app");

  return (
    <section data-operator-stub>
      <h1>{title}</h1>
      <p>{t("stubComingSoon", { subphase })}</p>
    </section>
  );
}
