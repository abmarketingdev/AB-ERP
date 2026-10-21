"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MockProvider } from "@/mocks/mock-provider";
import { MascotFilters } from "@/components/patterns/mascot-filters";
import { LocaleProvider, LocaleScope } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { StepUpProvider } from "@/lib/step-up";

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
    <ThemeProvider>
    <MockProvider>
      {/* One instance serves every mascot on the page — `filter: url(#id)`
          resolves against the document, not the subtree. Above the query client
          so the boot screen's loop is already arctic on first paint. */}
      <MascotFilters />
      <QueryClientProvider client={queryClient}>
        {/* LocaleProvider sits inside the query client so that LocaleScope can
            remount the UI on a language change without discarding the cache and
            refetching everything. */}
        <LocaleProvider>
          <TooltipProvider delayDuration={150}>
            {/* IFK-04: any page can ask for 2FA when the server answers step_up_required. */}
            <StepUpProvider>
              <LocaleScope>{children}</LocaleScope>
            </StepUpProvider>
          </TooltipProvider>
        </LocaleProvider>
      </QueryClientProvider>
    </MockProvider>
    </ThemeProvider>
  );
}
