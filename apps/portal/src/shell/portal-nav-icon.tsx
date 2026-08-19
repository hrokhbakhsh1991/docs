"use client";

import { Home, LayoutGrid, MapPin, MoreHorizontal, User, Wallet } from "lucide-react";
import type { ReactElement } from "react";

const ICON_SIZE = 22;

export function PortalNavIcon({ moduleId }: { readonly moduleId: string }): ReactElement | null {
  const props = { size: ICON_SIZE, strokeWidth: 2, "aria-hidden": true as const };
  switch (moduleId) {
    case "home":
      return <Home {...props} />;
    case "trips":
      return <MapPin {...props} />;
    case "wallet":
      return <Wallet {...props} />;
    case "profile":
      return <User {...props} />;
    case "more":
      return <MoreHorizontal {...props} />;
    default:
      return <LayoutGrid {...props} />;
  }
}
