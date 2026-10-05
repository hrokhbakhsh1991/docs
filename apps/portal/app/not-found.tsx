import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

// The portal is tenant- and locale-aware; a static not-found page can execute
// outside the request context required by next-intl and turn a missing route
// into a 500 global error. Keep the fallback on the same dynamic surface as
// the root layout so unknown URLs remain a real 404.
export const dynamic = "force-dynamic";

type PortalNotFoundCopy = {
  readonly title: string;
  readonly body: string;
  readonly back: string;
  readonly metadataTitle: string;
  readonly metadataDescription: string;
};

const FALLBACK_COPY: PortalNotFoundCopy = {
  title: "Page not found",
  body: "This page does not exist or is not available on this portal.",
  back: "Back to home",
  metadataTitle: "Page not found",
  metadataDescription: "This page does not exist.",
};

async function resolvePortalNotFoundCopy(): Promise<PortalNotFoundCopy> {
  try {
    const t = await getTranslations("common.pageNotFound");
    return {
      title: t("title"),
      body: t("body"),
      back: t("back"),
      metadataTitle: t("metadataTitle"),
      metadataDescription: t("metadataDescription"),
    };
  } catch {
    return FALLBACK_COPY;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const copy = await resolvePortalNotFoundCopy();
  return {
    title: copy.metadataTitle,
    description: copy.metadataDescription,
  };
}

export default async function PortalNotFound() {
  const copy = await resolvePortalNotFoundCopy();

  return (
    <main data-portal-not-found data-portal-page-not-found>
      <h1>{copy.title}</h1>
      <p>{copy.body}</p>
      <p>
        <Link href="/">{copy.back}</Link>
      </p>
    </main>
  );
}
