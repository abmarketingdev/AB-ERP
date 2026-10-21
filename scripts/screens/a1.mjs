// A1's screens for the design review. See harness.mjs.
import { emptyPage, fail, json, login, never, run, shoot, upstream } from "./harness.mjs";

const out = process.env.SCREENS_OUT;
if (!out) throw new Error("SCREENS_OUT is required");
const auth = await login(process.env.ADMIN_USER ?? "admin_lars", process.env.ADMIN_PW);

const only = (process.env.SCREENS_ONLY ?? "").split(",").filter(Boolean);
const want = (name, state) => !only.length || only.includes(`${name}:${state}`) || only.includes(name);
const shootIf = (b, o) => (want(o.name, o.state) ? shoot(b, o) : Promise.resolve());

await run(async (b) => {
  const admin = [
    ["tilganger", "/admin/tilganger", "**/api/recruitment/access/users/**", emptyPage],
    ["revisjonslogg", "/admin/revisjonslogg", "**/api/recruitment/audit/events/**", emptyPage],
    ["integrasjoner", "/admin/integrasjoner", "**/api/recruitment/integrations/", []],
  ];
  for (const [name, url, api, empty] of admin) {
    await shootIf(b, { out, name, state: "success", url, auth });
    await shootIf(b, { out, name, state: "loading", url, auth, routes: [[api, never]], wait: 1500 });
    await shootIf(b, { out, name, state: "empty", url, auth, routes: [[api, json(empty)]] });
    await shootIf(b, { out, name, state: "error", url, auth, routes: [[api, fail]] });
  }
  // tilganger: a module expanded + the reason prompt open (the confirm moment)
  await shootIf(b, { out, name: "tilganger", state: "interaction", url: "/admin/tilganger", auth, after: async (p) => {
    await p.getByRole("button", { name: /Kandidater/ }).first().click().catch(() => {});
    await p.getByRole("switch", { name: /Kandidater/ }).first().click().catch(() => {});
    await p.waitForTimeout(600);
  } });
  // integrasjoner partial: ONE source of truth — the SMS row fails and the alert names SMS.
  const failing = { status: "failing", enabled: true, consecutiveFailures: 4, lastError: "Tidsavbrudd mot leverandøren etter 15 s" };
  await shootIf(b, { out, name: "integrasjoner", state: "partial", url: "/admin/integrasjoner", auth, routes: [
    ["**/api/recruitment/integrations/", async (route) => {
      const r = await upstream(route); const list = await r.json();
      for (const row of list) if (row.name === "sms") Object.assign(row, failing, { lastFailureAt: new Date().toISOString() });
      for (const row of list) if (row.name === "tiktok_audience") Object.assign(row, { status: "off", enabled: false });
      await route.fulfill({ response: r, json: list });
    }],
    ["**/api/recruitment/integrations/alerts/", json([{ id: 1, integration: "sms", label: "SMS", consecutiveFailures: 4,
      createdAt: new Date().toISOString(),
      message: "SMS har feilet 4 ganger på rad. Bekreftelser og påminnelser til kandidater sendes ikke. Siste feil: Tidsavbrudd mot leverandøren etter 15 s" }])],
  ] });
  // step-up: the server demands 2FA when a switch is flipped. Viewport shots (bottom sheet on phone).
  await shootIf(b, { out, name: "step-up", state: "success", url: "/admin/integrasjoner", auth, fullPage: false, routes: [
    ["**/api/recruitment/integrations/*/", (route) => route.request().method() === "PATCH"
      ? route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ message: "Denne handlingen krever tofaktor.", code: "step_up_required" }) })
      : route.fallback()],
  ], after: async (p) => {
    await p.getByRole("button", { name: /SMS|Kalender|E-post/ }).first().click().catch(() => {});
    await p.getByRole("switch").first().click(); await p.waitForTimeout(1200);
  } });
  await shootIf(b, { out, name: "ingen-tilgang", state: "success", url: "/ingen-tilgang", auth, routes: [["**/api/recruitment/access/me/", json({
    userId: "x", username: "ole_sormbråten_stg", template: null, templateLabel: null, permissions: [], modules: [], stepUp: [],
    mfa: false, stepUpEnforced: false, isSuperuser: true, message: "Du har ikke fått tilgang til noen moduler ennå — kontakt Lars eller Joseph." })]] });
  await shootIf(b, { out, name: "login", state: "default", url: "/login" });
  await shootIf(b, { out, name: "login", state: "error", url: "/login", after: async (p) => {
    await p.locator("#email").pressSequentially("ole@abmarketing.no", { delay: 5 });
    await p.locator("#password").pressSequentially("feil-passord", { delay: 5 });
    await p.getByRole("button", { name: "Logg inn", exact: true }).click();
    // Real staging login with a shared address takes ~1.3 s + network: wait for the alert
    // itself, then past its 200 ms fade-in, or the shot catches it half-transparent.
    await p.getByRole("alert").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
  } });
});
