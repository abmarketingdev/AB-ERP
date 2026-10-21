// Live checks against the api-mode build (master 2026-10-22). See harness.mjs.
//
//   1. Per test account: log in, land on homeHref, open every menu entry. Fails on any
//      /api response 404 (a widget without a backend), on a raw ISO timestamp in the page
//      text (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/ — use showDate()), and on landing elsewhere
//      than a working page.
//   2. Public pages with a stored DARK staff theme must still look light: the .light island
//      has a light background and its text is readable on it.
//
// ACCOUNTS="user:password,user:password" (passwords never in files — pass them in the env).
// Exit code 1 with a list when anything fails.
import { BASE, json, run } from "./harness.mjs";

const API_BASE = process.env.API_BASE ?? "https://api-test.absystem.no";
const ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const accounts = (process.env.ACCOUNTS ?? "").split(",").filter(Boolean).map((a) => {
  const i = a.indexOf(":");
  return { user: a.slice(0, i), pw: a.slice(i + 1) };
});
// Where each test account must land (master 2026-10-22: the person's main job).
const EXPECT_HOME = {
  admin_lars: "/admin/tilganger", Joseph: "/admin/tilganger",
  ole_erp: "/godkjenning", "ole_sormbråten_stg": "/godkjenning",
  rek_hr: "/onboarding", rek_ledelse: "/dashboard",
  rek_leder: "/leder/intervjuer", rek_leder_b: "/leder/intervjuer",
  rek_rekrutterer: "/rekruttering/innboks",
  rek_promotor: "/promoter/vaktplan", rek_promotor_pluss: "/promoter/vaktplan",
};
const problems = [];
const report = (who, what) => { problems.push(`${who}: ${what}`); console.log(`FAIL ${who}: ${what}`); };

async function pageFor(browser, theme, auth) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "nb-NO",
    timezoneId: "Europe/Oslo", colorScheme: theme });
  await ctx.addInitScript(([th, a]) => {
    localStorage.setItem("ab-erp-theme", th);
    if (a) { localStorage.setItem("ab-erp-token", a.access); localStorage.setItem("ab-erp-refresh", a.refresh); }
  }, [theme, auth]);
  const p = await ctx.newPage();
  await p.route("**/api/**", async (route) => {
    const u = new URL(route.request().url());
    // Never let Playwright dump a failing request: its headers carry the Bearer token.
    try { await route.fulfill({ response: await route.fetch({ url: API_BASE + u.pathname + u.search }) }); }
    catch { await route.abort().catch(() => {}); }
  });
  return { ctx, p };
}

async function settle(p) {
  await p.waitForLoadState("domcontentloaded").catch(() => {});
  await p.waitForTimeout(3500);
}

async function walkRole(browser, { user, pw }) {
  // Through the real login form, so homeHref is what a person lands on.
  const { ctx, p } = await pageFor(browser, "light", null);
  const notFound = new Set();
  let where = "/login";
  p.on("response", (r) => {
    if (r.status() === 404 && new URL(r.url()).pathname.startsWith("/api/")) notFound.add(`${new URL(r.url()).pathname}  (på ${where})`);
  });
  await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await p.locator("#email").fill(user);
  await p.locator("#password").fill(pw);
  await p.locator('button[type="submit"]').first().click();
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 }).catch(() => {});
  await settle(p);
  if (new URL(p.url()).pathname.startsWith("/login")) {
    report(user, "innlogging i skjemaet feilet");
    await ctx.close();
    return;
  }
  const home = new URL(p.url()).pathname;
  where = home;
  if (home.startsWith("/login") || home === "/ingen-tilgang") report(user, `landet på ${home} etter innlogging`);
  else if (EXPECT_HOME[user] && home !== EXPECT_HOME[user]) report(user, `landet på ${home}, skal lande på ${EXPECT_HOME[user]}`);
  const hrefs = await p.$$eval('nav[aria-label="Hovedmeny"] a[href]', (as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
  for (const href of [home, ...hrefs.filter((h) => h !== home)]) {
    where = href;
    if (href !== home) { await p.goto(BASE + href, { waitUntil: "domcontentloaded", timeout: 120000 }); await settle(p); }
    const now = new URL(p.url()).pathname;
    if (now !== href) report(user, `menypunktet ${href} sendte videre til ${now}`);
    const text = await p.innerText("body").catch(() => "");
    const iso = text.match(new RegExp(`.{0,30}${ISO.source}.{0,10}`));
    if (iso) report(user, `rått ISO-tidsstempel på ${href}: «${iso[0].trim()}»`);
  }
  for (const nf of notFound) report(user, `404 fra ${nf}`);
  console.log(`ok? ${user}: hjem ${home}, ${hrefs.length} menypunkter`);
  await ctx.close();
}

async function publicStaysLight(browser) {
  const pages = [
    ["/avmeld/K7Q2M9XD", [["**/api/recruitment/public/optout/**", json({ masked: "+47 4•• •• 099", optedOut: false, already: false })]]],
    ["/avmeld/AAAAAAAA", []],
    ["/soknad/00000000-0000-0000-0000-000000000000", []],
    ["/intervju/ugyldig", []],
  ];
  for (const [url, routes] of pages) {
    const { ctx, p } = await pageFor(browser, "dark", null);
    for (const [pattern, handler] of routes) await p.route(pattern, handler);
    await p.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 120000 });
    await settle(p);
    const htmlDark = await p.evaluate(() => document.documentElement.classList.contains("dark"));
    const island = await p.evaluate(() => {
      const el = document.querySelector(".light");
      if (!el) return null;
      // Computed colours come back as lab()/oklch(); a 1×1 canvas turns any CSS colour into
      // sRGB, then WCAG relative luminance.
      const cv = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
      const lum = (css) => {
        cv.clearRect(0, 0, 1, 1); cv.fillStyle = "#000"; cv.fillStyle = css; cv.fillRect(0, 0, 1, 1);
        const [r, g, b] = [...cv.getImageData(0, 0, 1, 1).data].slice(0, 3).map((v) => {
          const c = v / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const bg = getComputedStyle(el).backgroundColor;
      const texts = [...el.querySelectorAll("h1, h2, p, label, button, a, span")]
        .filter((n) => n.offsetParent !== null && n.textContent.trim() && n.children.length === 0)
        .slice(0, 60).map((n) => ({ t: n.textContent.trim().slice(0, 30), c: getComputedStyle(n).color, l: lum(getComputedStyle(n).color) }));
      return { bg, bgL: lum(bg), texts };
    });
    if (!htmlDark) { report("offentlig", `${url}: testen satte ikke mørkt tema (forutsetning)`); }
    else if (!island) report("offentlig", `${url}: ingen .light-øy`);
    else {
      const bgL = island.bgL;
      if (bgL < 0.8) report("offentlig", `${url}: bakgrunnen er mørk (${island.bg}) med lagret mørkt tema`);
      for (const { t, c, l } of island.texts) {
        const ratio = (Math.max(bgL, l) + 0.05) / (Math.min(bgL, l) + 0.05);
        if (ratio < 3) { report("offentlig", `${url}: «${t}» er nesten usynlig (${c} på ${island.bg}, ${ratio.toFixed(1)}:1)`); break; }
      }
    }
    console.log(`ok? offentlig ${url}`);
    await ctx.close();
  }
}

await run(async (b) => {
  if (!process.env.SKIP_PUBLIC) await publicStaysLight(b);
  for (const a of accounts) await walkRole(b, a);
});
console.log(problems.length ? `\n${problems.length} problem(er)` : "\nAlle sjekker grønne");
process.exit(problems.length ? 1 : 0);
