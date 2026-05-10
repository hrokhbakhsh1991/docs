import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * Locale-aware `Link`, `redirect`, `usePathname`, `useRouter` for incremental adoption.
 * Most of the app still uses `next/link`; unprefixed URLs are redirected by middleware.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
