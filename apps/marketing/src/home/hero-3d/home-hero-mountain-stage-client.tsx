"use client";

import dynamic from "next/dynamic";

import type { HomeHeroMountainStageProps } from "./home-hero-mountain-stage";

const HomeHeroMountainStage = dynamic(
  () => import("./home-hero-mountain-stage").then((module) => module.HomeHeroMountainStage),
  {
    ssr: false,
    loading: () => <div data-marketing-home-hero-stage data-marketing-home-hero-stage-loading />,
  }
);

export function HomeHeroMountainStageClient(props: HomeHeroMountainStageProps) {
  return <HomeHeroMountainStage {...props} />;
}
