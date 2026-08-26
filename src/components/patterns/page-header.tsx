"use client";

import * as React from "react";
import { useT } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";

interface PageHeaderProps {
  title: string;
  description?: string;
  period?: string;
  source?: string;
  lastUpdated?: Date | string;
  actions?: React.ReactNode;
}

/**
 * FR-S-06 — period, data source and last-updated, on every data view.
 *
 * It lives in one component precisely so it cannot be skipped: a screen that
 * wants a heading gets the provenance line with it. A figure whose period and
 * source are not on screen is a figure somebody will quote in a meeting with
 * the wrong month attached.
 */
export function PageHeader({ title, description, period, source, lastUpdated, actions }: PageHeaderProps) {
  const t = useT();
  const hasMeta = period || source || lastUpdated;

  return (
    <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-medium tracking-tight text-foreground sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        {hasMeta && (
          <dl className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {period && (
              <div className="flex items-center gap-1">
                <dt className="font-medium text-foreground/70">{t("Periode")}:</dt>
                <dd>{period}</dd>
              </div>
            )}
            {source && (
              <div className="flex items-center gap-1">
                <dt className="font-medium text-foreground/70">{t("Kilde")}:</dt>
                <dd>{source}</dd>
              </div>
            )}
            {lastUpdated && (
              <div className="flex items-center gap-1">
                <dt className="font-medium text-foreground/70">{t("Oppdatert")}:</dt>
                <dd>{formatDateTime(lastUpdated)}</dd>
              </div>
            )}
          </dl>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
