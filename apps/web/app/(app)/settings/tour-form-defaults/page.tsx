import { redirect } from "next/navigation";

/** Legacy URL; canonical presets UI lives at `/settings/tour-presets`. */
export default function TourFormDefaultsLegacyRedirectPage() {
  redirect("/settings/tour-presets");
}
