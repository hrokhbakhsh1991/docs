"use client";

import { clearSessionToken } from "./session";

type RouterLike = {
  push: (href: string) => void;
  refresh: () => void;
};

export function logoutWithRouter(router: RouterLike): void {
  clearSessionToken();
  router.push("/login");
  router.refresh();
}
