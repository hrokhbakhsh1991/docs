import Link from "next/link";

import { Button } from "@app-tour/ui-primitives/button";
import { Input } from "@app-tour/ui-primitives/input";

export type CatalogCityFilterFormProps = {
  readonly defaultCity: string;
  readonly cityLabel: string;
  readonly cityPlaceholder: string;
  readonly applyLabel: string;
  readonly clearLabel: string;
  readonly showClear: boolean;
  /** Locale-aware tours list path (M9) — e.g. from `resolveMarketingToursListPath`. */
  readonly listPath: string;
};

export function CatalogCityFilterForm({
  defaultCity,
  cityLabel,
  cityPlaceholder,
  applyLabel,
  clearLabel,
  showClear,
  listPath,
}: CatalogCityFilterFormProps) {
  return (
    <form method="get" data-marketing-city-filter>
      <label htmlFor="city">{cityLabel}</label>
      <Input
        id="city"
        name="city"
        type="search"
        defaultValue={defaultCity}
        placeholder={cityPlaceholder}
      />
      <Button type="submit">{applyLabel}</Button>
      {showClear ? (
        <Link href={listPath} data-marketing-city-clear>
          {clearLabel}
        </Link>
      ) : null}
    </form>
  );
}
