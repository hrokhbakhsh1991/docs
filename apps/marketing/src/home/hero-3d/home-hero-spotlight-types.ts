import type { HomeDestinationId } from "../home-destination-ids";

/** Serializable spotlight payload for the hero 3D stage (server → client). */
export type HomeHeroSpotlight = Readonly<{
  readonly id: HomeDestinationId;
  readonly imagePath: string;
  readonly name: string;
  readonly tagline: string;
  readonly description: string;
  readonly elevationLabel: string;
  readonly elevationValue: string;
  readonly regionLabel: string;
  readonly regionValue: string;
  readonly toursHref: string;
}>;
