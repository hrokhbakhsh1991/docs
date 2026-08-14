"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

type TourInternalLinkProps = ComponentProps<typeof Link>;

/**
 * Operator tour surfaces — client-side Next.js navigation.
 * - scroll={false}: avoid scroll jump that feels like a full reload
 * - prefetch={true}: warm RSC payload for edit ↔ workspace hops
 *
 * Use with shadcn `Button asChild` (never wrap Button inside Link).
 */
export function TourInternalLink({
  scroll = false,
  prefetch = true,
  ...props
}: TourInternalLinkProps) {
  return <Link scroll={scroll} prefetch={prefetch} {...props} />;
}

/** Cross-app operator links (bookings, finance hub) — same soft-nav defaults. */
export const OperatorInternalLink = TourInternalLink;
