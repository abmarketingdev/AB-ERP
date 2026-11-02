"use client";

import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { PermissionGate } from "@/components/patterns/permission-gate";
import { CalendarWeek } from "@/components/booking/calendar-week";

/**
 * «Min kalender» (client 2026-11-02): the signed-in person's own Google Calendar, synced
 * through the company's service account (domain-wide delegation, keyed on the e-mail of
 * the account they logged in with), with our interviews on top. Only you see your own
 * titles; colleagues booking for you see «Opptatt».
 */
export default function MinKalender() {
  return (
    <PermissionGate permission="mycalendar.view">
      <div className="flex flex-1 flex-col gap-6">
        <PageHeader
          title="Min kalender"
          description="Google Kalenderen din og intervjuene dine. Andre som booker for deg ser bare når du er opptatt."
          source="Google Kalender"
        />
        <Card>
          <CardContent className="pt-6">
            <CalendarWeek />
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  );
}
