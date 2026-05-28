"use client";

import { clearSessionToken } from "./session";

type RouterLike = {
  push: (_href: string) => void;
  refresh: () => void;
};

export function logoutWithRouter(router: RouterLike): void {
  void (async () => {
    await clearSessionToken();
    router.push("/login");
    router.refresh();
  })();
}
