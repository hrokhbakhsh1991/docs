import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@tour/ui/styles.css";
import "./globals.css";

import { AppChromeProviders } from "./providers";

/** Workspace UI shell: `@tour/ui` `AppLayout` is composed in `app/(app)/layout.tsx`; auth uses `AuthLayout` in `app/auth/layout.tsx`. */

export const metadata: Metadata = {
  title: {
    default: "TourOps",
    template: "%s | TourOps",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Default document locale/dir; `app/(app)/tours/layout.tsx` wraps fa/rtl for the tours subtree.
  return (
    <html lang="en" dir="ltr" className="theme-light">
      <body>
        <AppChromeProviders>{children}</AppChromeProviders>
      </body>
    </html>
  );
}
