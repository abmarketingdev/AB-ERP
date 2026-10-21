/**
 * Shared screenshot harness for the design review (08-DESIGN-REVIEW §1). One setup for all
 * lanes so screens are comparable: PRODUCTION build, locale nb-NO, timezone Europe/Oslo,
 * reduced motion, widths 1440/768/400, light and dark.
 *
 *   NEXT_PUBLIC_DATA_SOURCE=api npm run build
 *   SCREENS_OUT=../…/plans/screens/A<N> ADMIN_USER=admin_lars ADMIN_PW=… node scripts/screens/a1.mjs
 *
 * A production build has no dev rewrites, so /api/* is forwarded to API_BASE (staging) by
 * Playwright routing — same-origin for the app, real data behind it. State overrides
 * (loading/empty/error) are registered after the proxy and win.
 *
 * The server runs in its own process group and is killed as a group: `pkill -f "next …"`
 * matches the calling shell's own command line and kills it (known trap).
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import { chromium } from "playwright";

export const WIDTHS = [[1440, 900], [768, 1024], [400, 860]];
export const THEMES = ["light", "dark"];
const PORT = Number(process.env.SCREENS_PORT ?? 3430);
export const BASE = `http://localhost:${PORT}`;
const API_BASE = process.env.API_BASE ?? "https://api-test.absystem.no";

export const never = () => new Promise(() => {});
export const fail = (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Intern feil" }) });
export const json = (data, status = 200) => (route) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
/** Inside an override: fetch the REAL response from staging (route.fetch() alone would hit Next). */
export async function upstream(route) {
  const u = new URL(route.request().url());
  return route.fetch({ url: API_BASE + u.pathname + u.search });
}

export const emptyPage = { count: 0, page: 1, pageSize: 100, totalPages: 0, next: null, previous: null, results: [] };

export async function startServer() {
  const child = spawn("npx", ["next", "start", "-p", String(PORT)], { detached: true, stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/login`)).ok) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return () => { try { process.kill(-child.pid, "SIGTERM"); } catch { /* already gone */ } };
}

export async function login(username, password, platform = "erp") {
  const res = await fetch(`${API_BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, platform }) });
  if (!res.ok) throw new Error(`login ${username}: ${res.status}`);
  return res.json();
}

/**
 * shoot(browser, { out, name, state, url, auth, routes, wait, after, fullPage })
 * → out/<name>/<state>-<width>-<theme>.png for every width × theme.
 */
export async function shoot(browser, { out, name, state, url, auth = null, routes = [], wait = 3000, after, fullPage }) {
  fs.mkdirSync(`${out}/${name}`, { recursive: true });
  for (const theme of THEMES) for (const [w, h] of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h }, locale: "nb-NO", timezoneId: "Europe/Oslo",
      reducedMotion: "reduce", colorScheme: theme,
    });
    await ctx.addInitScript(([th, a]) => {
      localStorage.setItem("ab-erp-theme", th);
      if (a) { localStorage.setItem("ab-erp-token", a.access); localStorage.setItem("ab-erp-refresh", a.refresh); }
    }, [theme, auth]);
    const p = await ctx.newPage();
    await p.route("**/api/**", async (route) => {
      const u = new URL(route.request().url());
      const r = await route.fetch({ url: API_BASE + u.pathname + u.search });
      await route.fulfill({ response: r });
    });
    for (const [pattern, handler] of routes) await p.route(pattern, handler);
    await p.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.waitForTimeout(wait);
    if (after) await after(p, { width: w, theme });
    // Phone: the viewport, so bottom sheets and the thumb zone are judged as seen.
    await p.screenshot({ path: `${out}/${name}/${state}-${w}-${theme}.png`, fullPage: fullPage ?? w > 400 });
    await ctx.close();
  }
  console.log("shot", name, state);
}

export async function run(fn) {
  const stop = await startServer();
  // A throw inside a route handler is an unhandled rejection, not an exception in fn — stop
  // the server on that path too, or it keeps the port.
  process.once("unhandledRejection", (e) => { stop(); console.error(e); process.exit(1); });
  const browser = await chromium.launch();
  try { await fn(browser); } finally { await browser.close(); stop(); }
}
