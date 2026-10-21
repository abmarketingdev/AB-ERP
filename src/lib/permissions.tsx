"use client";

import * as React from "react";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
  /** Menu section heading («Rekruttering», «Administrasjon»…). Long menus group by it. */
  section?: string;
}

/**
 * What a user is allowed to see, as data.
 *
 * Doc 01: "One portal, two scopes: a team lead sees their own team, a sales
 * chief sees all teams beneath them." Scope is therefore a *parameter* of the
 * same screens, not a second build — and it is the widest set the user may ever
 * request, not the set they happen to be looking at. Narrowing is a UI choice;
 * widening is impossible, and the mock API enforces that from the bearer token
 * rather than trusting a query parameter the client chose.
 */
export interface Scope {
  kind: "self" | "team" | "org";
  /** Every team this user may see. A request outside it is refused, not filtered. */
  teamIds: string[];
  label: string;
}

export interface Session {
  key: string;
  userId: string;
  name: string;
  role: string;
  permissions: string[];
  navigation: NavItem[];
  scope: Scope;
  /** Where login lands. Defaults to the first menu item; set when the menu is sectioned
   *  and the person's own front page is not first (a leader lands on /leder, not Kandidater). */
  homeHref?: string;
}

const SessionContext = React.createContext<Session | null>(null);

export function SessionProvider({ session, children }: { session: Session | null; children: React.ReactNode }) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): Session | null {
  return React.useContext(SessionContext);
}

export function useHasPermission(permission: string): boolean {
  const session = useSession();
  return session?.permissions.includes(permission) ?? false;
}
