import Link from "next/link";
import type { ComponentProps } from "react";

export type HomeSectionViewAllLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  readonly href?: string;
};

/** Shared pill control for section headers linking to `/tours` (PR-25). */
export function HomeSectionViewAllLink({ href = "/tours", ...props }: HomeSectionViewAllLinkProps) {
  return <Link href={href} data-marketing-home-section-view-all {...props} />;
}
