"use client";

import { Search } from "lucide-react";
import { useId } from "react";

import { Input } from "@/components/ui/input";

type OperatorDirectorySearchFieldProps = {
  readonly label: string;
  readonly placeholder?: string;
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly testId?: string;
};

/** Named controlled input; directories own filtering, debounce and URL state. */
export function OperatorDirectorySearchField({
  label,
  placeholder,
  value,
  onValueChange,
  testId,
}: OperatorDirectorySearchFieldProps) {
  const id = useId();

  return (
    <div className="relative min-w-0 max-w-xl flex-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        id={id}
        type="search"
        data-testid={testId}
        className="ps-9"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      />
    </div>
  );
}
