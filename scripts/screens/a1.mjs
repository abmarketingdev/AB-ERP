// A1's screens for the design review. See harness.mjs.
import { emptyPage, fail, json, login, never, run, shoot, upstream } from "./harness.mjs";

const out = process.env.SCREENS_OUT;
if (!out) throw new Error("SCREENS_OUT is required");
const only = (process.env.SCREENS_ONLY ?? "").split(",").filter(Boolean);
// Public pages (no login) can be shot on their own without touching auth.
const PUBLIC = ["avmeld", "login"];
const publicOnly = only.length > 0 && only.every((o) => PUBLIC.includes(o.split(":")[0]));
const auth = publicOnly ? null : await login(process.env.ADMIN_USER ?? "admin_lars", process.env.ADMIN_PW);
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
  // IFK-02 /admin/personvern — privacy.admin is a step-up key, so every privacy call is mocked here.
  const SUBJ = "**/api/recruitment/privacy/subjects/**", RET = "**/api/recruitment/privacy/retention/**", ERASE = "**/api/recruitment/privacy/erase/**";
  const kari = { subjectRef: "s1", found: true, apps: [{ app: "leads", items: 1 }, { app: "candidates", items: 1 }, { app: "notify", items: 6 }, { app: "interviews", items: 1 }] };
  const runs = [{ id: 3, startedAt: "2026-10-22T02:15:00+02:00", finishedAt: "2026-10-22T02:15:04+02:00", dryRun: true, cutoff: "2023-10-22",
    found: 14, anonymised: 0, perApp: [{ app: "leads", count: 9 }, { app: "candidates", count: 5 }], error: "" }];
  const find = (q) => async (p) => { await p.getByLabel("Telefonnummer eller e-post personen oppga").fill(q);
    await p.getByRole("button", { name: "Finn personen" }).click(); await p.waitForTimeout(900); };
  const PV = "/admin/personvern";
  await shootIf(b, { out, name: "personvern", state: "loading", url: PV, auth, routes: [[RET, never], [SUBJ, never]], wait: 1500, after: find("912 34 567") });
  await shootIf(b, { out, name: "personvern", state: "success", url: PV, auth, routes: [[RET, json(runs)], [SUBJ, json(kari)]], after: find("912 34 567") });
  await shootIf(b, { out, name: "personvern", state: "empty", url: PV, auth, routes: [[RET, json([])], [SUBJ, json({ subjectRef: "s0", found: false, apps: [] })]], after: find("400 00 000") });
  await shootIf(b, { out, name: "personvern", state: "error", url: PV, auth, routes: [[RET, fail], [SUBJ, fail]], after: find("912 34 567") });
  await shootIf(b, { out, name: "personvern", state: "interaction", url: PV, auth, routes: [[RET, json(runs)], [SUBJ, json(kari)]], after: async (p) => {
    await find("912 34 567")(p);
    await p.getByLabel(/Begrunnelse for slettingen/).fill("Kandidaten ba om sletting på e-post 22.10.");
    await p.getByRole("button", { name: "Slett personopplysninger" }).click(); await p.waitForTimeout(400); } });
  await shootIf(b, { out, name: "personvern", state: "done", url: PV, auth, routes: [[RET, json(runs)], [SUBJ, json(kari)],
    [ERASE, json({ requestId: "x", report: [{ app: "leads", rows: 1 }, { app: "candidates", rows: 1 }, { app: "notify", rows: 6 }, { app: "interviews", rows: 1 }] }, 201)]],
    after: async (p) => {
      await find("912 34 567")(p);
      await p.getByLabel(/Begrunnelse for slettingen/).fill("Kandidaten ba om sletting på e-post 22.10.");
      await p.getByRole("button", { name: "Slett personopplysninger" }).click();
      await p.getByRole("textbox", { name: /SLETT/ }).fill("SLETT").catch(() => {});
      await p.getByRole("button", { name: "Slett for godt" }).click(); await p.waitForTimeout(1200); } });
  await shootIf(b, { out, name: "personvern", state: "invalid", url: PV, auth, routes: [[RET, json(runs)]], after: find("123") });

  // §8.1 l.743 — the public opt-out page (no login), all five states + the confirm moment.
  const OPT = "**/api/recruitment/public/optout/**";
  const live = { masked: "+47 4•• •• 099", optedOut: false, already: false };
  await shootIf(b, { out, name: "avmeld", state: "loading", url: "/avmeld/K7Q2M9XD", routes: [[OPT, never]], wait: 1500 });
  await shootIf(b, { out, name: "avmeld", state: "success", url: "/avmeld/K7Q2M9XD", routes: [[OPT, json(live)]] });
  await shootIf(b, { out, name: "avmeld", state: "interaction", url: "/avmeld/K7Q2M9XD", routes: [[OPT, json(live)]],
    after: async (p) => { await p.getByRole("button", { name: "Meld meg av SMS" }).click(); await p.waitForTimeout(400); } });
  await shootIf(b, { out, name: "avmeld", state: "done", url: "/avmeld/K7Q2M9XD", routes: [[OPT, async (route) =>
    route.request().method() === "POST" ? json({ ...live, optedOut: true })(route) : json(live)(route)]],
    after: async (p) => { await p.getByRole("button", { name: "Meld meg av SMS" }).click();
      await p.getByRole("button", { name: "Ja, meld meg av" }).click(); await p.waitForTimeout(1500); } });
  await shootIf(b, { out, name: "avmeld", state: "empty", url: "/avmeld/K7Q2M9XD", routes: [[OPT, json({ ...live, optedOut: true, already: true })]] });
  await shootIf(b, { out, name: "avmeld", state: "error", url: "/avmeld/AAAAAAAA", routes: [[OPT, json({ message: "ugyldig" }, 404)]] });
  await shootIf(b, { out, name: "avmeld", state: "partial", url: "/avmeld/K7Q2M9XD", routes: [[OPT, fail]] });

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
