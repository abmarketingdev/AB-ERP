"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LogOut,
  Home,
  BarChart3,
  Calendar,
  Target,
  GraduationCap,
  Newspaper,
  AlertTriangle,
  ClipboardList,
  LayoutGrid,
  BookOpen,
  Upload,
  Lock,
  History,
  Users,
  Building2,
  Activity,
  Wrench,
  Eye,
  Inbox,
  ShieldCheck,
  UserPlus,
  Megaphone,
  CalendarCheck,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { Session } from "@/lib/permissions";
import { SessionProvider } from "@/lib/permissions";
import { clearSessionKey } from "@/lib/use-session-guard";
import { Mascot } from "./mascot";
import { ScopeSwitcher } from "./scope-switcher";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeSwitcher } from "./theme-switcher";
import { useT } from "@/lib/i18n";
import { PreviewBanner } from "./preview-banner";
import { Button } from "@/components/ui/button";

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  "bar-chart": BarChart3,
  calendar: Calendar,
  target: Target,
  "graduation-cap": GraduationCap,
  newspaper: Newspaper,
  "alert-triangle": AlertTriangle,
  "clipboard-list": ClipboardList,
  "layout-grid": LayoutGrid,
  "book-open": BookOpen,
  upload: Upload,
  lock: Lock,
  history: History,
  users: Users,
  building: Building2,
  activity: Activity,
  wrench: Wrench,
  eye: Eye,
  inbox: Inbox,
  "shield-check": ShieldCheck,
  "user-plus": UserPlus,
  megaphone: Megaphone,
  "calendar-check": CalendarCheck,
};

interface ShellProps {
  session: Session;
  children: React.ReactNode;
}

/**
 * FR-S-09 — one shell, usable on a phone and on a desktop, with the promoter
 * portal designed for the phone first.
 *
 * Three layouts, not a scaled-down one: a sidebar on desktop, a top bar plus a
 * bottom tab bar on mobile. The promoter is standing in a stairwell between
 * doors holding a phone in one hand, so their navigation sits under the thumb
 * rather than behind a hamburger, and every target clears the 44px touch floor.
 * The `min-w-0` on <main> is load-bearing: as a flex row item it otherwise
 * grows to its widest child and pushes the whole page sideways.
 */
export function Shell({ session, children }: ShellProps) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const greetHour = new Date().getHours();
  const [mascotState, setMascotState] = React.useState<"greeting" | "idle">(greetHour < 10 ? "greeting" : "idle");

  React.useEffect(() => {
    if (mascotState === "greeting") {
      const t = setTimeout(() => setMascotState("idle"), 2200);
      return () => clearTimeout(t);
    }
  }, [mascotState]);

  function logout() {
    clearSessionKey();
    router.replace("/login");
  }

  return (
    <SessionProvider session={session}>
      {/*
       * The staff app runs dark throughout — long desk sessions, and hue
       * discrimination in charts is measurably better on a dark ground. The
       * promoter's field surface and the customer report stay light.
       */}
      <div className="relative flex min-h-screen w-full flex-col bg-background text-foreground">
        {/*
         * WCAG 2.4.1 — a way past the navigation.
         *
         * Invisible until it has focus, which is the point: the first Tab on
         * every page offers it, and a mouse user never sees it. Without it a
         * keyboard user walks the whole sidebar again on every navigation, and
         * this sidebar is six items plus a language control and sign-out.
         */}
        <a
          href="#hovedinnhold"
          className="sr-only left-3 top-3 z-50 rounded-md bg-[var(--ab-accent-9)] px-3 py-2 text-[13px] font-medium text-[var(--ab-accent-12)] focus:not-sr-only focus:absolute focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {t("Hopp til innholdet")}
        </a>
        <PreviewBanner />
        <div className="flex flex-1 flex-col md:flex-row">
        {/* Desktop sidebar */}
        <aside className="relative hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
          <div className="flex items-center gap-2.5 px-5 py-5">
            <span className="flex size-8 items-center justify-center rounded-md bg-[var(--ab-accent-9)]/12">
              <Mascot state={mascotState} size={22} interactive />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[13px] font-medium text-sidebar-foreground">AB ERP</p>
              <p className="truncate font-mono text-[11px] text-muted-foreground">{t(session.role)}</p>
            </div>
          </div>

          <ScopeSwitcher />

          <p className="px-5 pb-2 pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {t("Meny")}
          </p>

          {/* Named, because a screen reader lists landmarks and "navigation,
              navigation" is not a list. Only one of the two is ever in the
              accessibility tree — the other is display:none at that width — so
              they share a name rather than inventing "desktop"/"mobile", which
              are facts about the device, not about the menu. */}
          <nav aria-label={t("Hovedmeny")} className="relative flex-1 px-2">
            {session.navigation.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon ? ICONS[item.icon] : undefined;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors ${
                    active
                      ? "bg-[var(--ab-accent-9)]/10 text-foreground"
                      : "text-muted-foreground hover:bg-white/[0.03] hover:text-foreground"
                  }`}
                >
                  {/* Active state is a rail, not a filled pill — quieter, and it
                      reads instantly down the left edge when scanning. */}
                  {active && (
                    <motion.span
                      layoutId="nav-rail"
                      className="absolute inset-y-1 left-0 w-[2px] rounded-full bg-[var(--ab-accent-9)]"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  )}
                  {Icon && (
                    <Icon
                      className={`size-4 shrink-0 transition-colors ${
                        active ? "text-[var(--ab-accent-10)]" : "text-muted-foreground group-hover:text-foreground"
                      }`}
                    />
                  )}
                  <span className="truncate">{t(item.label)}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex flex-col gap-0.5 border-t border-sidebar-border p-2">
            <ThemeSwitcher />
            <LanguageSwitcher />
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground hover:bg-danger/10 hover:text-danger"
              onClick={logout}
            >
              <LogOut className="size-4" />
              {t("Logg ut")}
            </Button>
          </div>
        </aside>

        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-sidebar-border bg-sidebar px-4 py-3 text-sidebar-foreground md:hidden">
          <div className="flex items-center gap-2">
            <Mascot state={mascotState} size={28} interactive />
            <span className="text-sm font-medium">AB ERP</span>
          </div>
          <Button variant="ghost" size="icon" onClick={logout} aria-label={t("Logg ut")} className="hover:bg-danger/10 hover:text-danger">
            <LogOut className="size-4" />
          </Button>
        </header>

        {/*
          `min-w-0` matters more than it looks. `main` is a flex row item beside
          the sidebar, and a flex item's default `min-width: auto` means it grows
          to its widest descendant rather than clipping it. Without this, any
          wide child — a board with seven columns, a broad table — silently
          stretches the whole layout and the page scrolls sideways instead of the
          child scrolling inside itself.
        */}
        <main
          id="hovedinnhold"
          tabIndex={-1}
          className="flex min-w-0 flex-1 flex-col gap-6 px-4 pb-20 pt-4 outline-none sm:px-6 md:px-8 md:pb-8 md:pt-6"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="flex min-w-0 flex-1 flex-col gap-6"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Mobile bottom tab bar */}
        <nav
          aria-label={t("Hovedmeny")}
          className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-background/95 backdrop-blur md:hidden"
        >
          {session.navigation.slice(0, 5).map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon ? ICONS[item.icon] : undefined;
            return (
              <Link
                key={item.id}
                href={item.href}
                className="relative flex flex-1 flex-col items-center gap-0.5 px-1 py-2 text-center text-[10px] font-medium leading-tight"
              >
                {active && (
                  <motion.span
                    layoutId="tabbar-active-dot"
                    className="absolute top-0.5 h-1.5 w-1.5 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                <motion.span
                  animate={{ scale: active ? 1.1 : 1, color: active ? "var(--primary)" : "var(--muted-foreground)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 24 }}
                  className="mt-2"
                >
                  {Icon && <Icon className="size-[18px]" />}
                </motion.span>
                <span className={`line-clamp-1 ${active ? "text-primary" : "text-muted-foreground"}`}>{t(item.label)}</span>
              </Link>
            );
          })}
        </nav>
        </div>
      </div>
    </SessionProvider>
  );
}
