export function useRouter() {
  return { push: () => undefined, refresh: () => undefined };
}

export function usePathname() {
  return "/memlab-harness";
}

export function useSearchParams() {
  return new URLSearchParams();
}
