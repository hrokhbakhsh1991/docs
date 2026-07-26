type DenaliLogoMarkProps = {
  readonly className?: string;
};

/** Denali workspace mark — pairs with `theme/assets/logo-mark.svg`. */
export function DenaliLogoMark({ className }: DenaliLogoMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={className}
      data-operator-logo-mark
    >
      <rect width="32" height="32" rx="8" fill="currentColor" fillOpacity="0.1" />
      <path
        d="M6 22 13 10l4 7 3-5 6 10"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6 22h20" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
