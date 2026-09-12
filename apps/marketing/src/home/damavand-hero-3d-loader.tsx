"use client";

import dynamic from "next/dynamic";

const DamavandHero3D = dynamic(() => import("./damavand-hero-3d"), {
  ssr: false,
  loading: () => <div aria-hidden="true" data-damavand-hero-loading />,
});

export function DamavandHero3DLoader({ locale }: { readonly locale: "fa" | "en" }) {
  return <DamavandHero3D locale={locale} />;
}
