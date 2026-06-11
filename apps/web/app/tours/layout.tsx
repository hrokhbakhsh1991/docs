import type { ReactNode } from "react";

import { ToursWizardLayout } from "@/shell/tours-wizard-layout";

export default function ToursRouteLayout({ children }: { children: ReactNode }) {
  return <ToursWizardLayout>{children}</ToursWizardLayout>;
}
