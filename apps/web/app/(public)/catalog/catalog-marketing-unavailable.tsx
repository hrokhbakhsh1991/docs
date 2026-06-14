import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type CatalogMarketingUnavailableProps = {
  readonly marketingBaseUrl: string;
};

/** Shown when /catalog cannot redirect to apps/marketing (dev without marketing server). */
export function CatalogMarketingUnavailable({ marketingBaseUrl }: CatalogMarketingUnavailableProps) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg items-center px-4 py-12">
      <Card className="w-full" data-testid="catalog-marketing-unavailable">
        <CardHeader>
          <CardTitle>کاتالوگ عمومی در دسترس نیست</CardTitle>
          <CardDescription>
            سرور marketing روی {marketingBaseUrl} اجرا نشده است. برای dev، apps/marketing را روی پورت
            3002 اجرا کنید یا{" "}
            <code className="rounded bg-muted px-1 text-xs">MARKETING_PUBLIC_BASE_URL</code> را تنظیم
            کنید.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/tours">بازگشت به تورها</Link>
          </Button>
          <Button asChild variant="ghost">
            <a href={marketingBaseUrl} target="_blank" rel="noreferrer">
              امتحان marketing
            </a>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
