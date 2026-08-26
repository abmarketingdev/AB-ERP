"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MockProvider } from "@/mocks/mock-provider";
import { LocaleProvider, LocaleScope } from "@/lib/i18n";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <MockProvider>
      <QueryClientProvider client={queryClient}>
        {/* LocaleProvider sits inside the query client so that LocaleScope can
            remount the UI on a language change without discarding the cache and
            refetching everything. */}
        <LocaleProvider>
          <TooltipProvider delayDuration={150}>
            <LocaleScope>{children}</LocaleScope>
          </TooltipProvider>
        </LocaleProvider>
      </QueryClientProvider>
    </MockProvider>
  );
}
