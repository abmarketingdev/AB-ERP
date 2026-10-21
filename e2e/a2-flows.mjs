/**
 * A2 end-to-end flows in API mode against staging (brief §Tests, 08-DESIGN-REVIEW):
 *   1. Recruiter sends a lead on from the samleinnboks (LEAD-08).
 *   2. Recruiter drags a card Ny → Kvalifisert with the KEYBOARD, fills the form, card lands (KAND-02).
 *   3. A drop onto «Intervju booket» is refused and explains itself IN the column (KAND-02).
 *   4. Promotor+ on a phone (400 px): empty submit → error summary with focus; filled → registered (LEAD-05).
 * Usage: BASE=http://127.0.0.1:3100 TOKENS=<dir with rek_rekrutterer, rek_promotor_pluss> node e2e/a2-flows.mjs
 * Tokens are staging access tokens (one file per user). Mutates staging test data only.
 */
import { chromium } from "playwright";
import fs from "fs";

const BASE = process.env.BASE ?? "http://127.0.0.1:3100";
const tok = (u) => fs.readFileSync(`${process.env.TOKENS}/${u}`, "utf8").trim();
let failed = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name} ${ok ? "" : extra}`); if (!ok) failed++; };

async function as(browser, user, width = 1440) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce",
                                         locale: "nb-NO", timezoneId: "Europe/Oslo" });
  await ctx.addInitScript(([t]) => { try { localStorage.setItem("ab-erp-token", t); } catch {} }, [tok(user)]);
  return { ctx, page: await ctx.newPage() };
}

async function keyboardDrag(page, card, steps) {
  const grip = card.getByRole("button", { name: /^Flytt / });
  await card.scrollIntoViewIfNeeded();
  await grip.focus();
  await page.keyboard.press("Space");
  for (let i = 0; i < steps; i++) { await page.keyboard.press("ArrowRight"); await page.waitForTimeout(30); }
  await page.keyboard.press("Space");
}

const browser = await chromium.launch();

// 1 — send a lead on from the inbox.
{
  const { ctx, page } = await as(browser, "rek_rekrutterer");
  await page.goto(`${BASE}/rekruttering/innboks?status=ny`, { waitUntil: "networkidle" });
  const first = page.locator("tbody tr").first();
  if (await first.count()) {
    const name = (await first.locator("td").nth(1).innerText()).split("\n")[0];
    await first.getByRole("checkbox").check();
    await page.getByRole("button", { name: /^Send 1 til rekruttering/ }).click();
    await page.getByText(/1 lead sendt til rekruttering/).waitFor({ timeout: 15000 }).catch(() => {});
    check("1 send videre gir bekreftelse", await page.getByText(/1 lead sendt til rekruttering/).isVisible());
    await page.goto(`${BASE}/rekruttering/kandidater`, { waitUntil: "networkidle" });
    check("1 kandidaten finnes i listen", await page.getByText(name, { exact: true }).first().isVisible(), name);
  } else {
    console.log("SKIP 1 ingen nye leads tildelt rek_rekrutterer på staging");
  }
  await ctx.close();
}

// 2 + 3 — the board, by keyboard.
{
  const { ctx, page } = await as(browser, "rek_rekrutterer");
  await page.goto(`${BASE}/rekruttering/kandidater`, { waitUntil: "networkidle" });
  await page.getByText("Tavle", { exact: true }).first().click();
  const ny = page.locator('[data-board-column="ny"] li').first();
  if (await ny.count()) {
    const name = (await ny.innerText()).split("\n")[0];
    await keyboardDrag(page, ny, 30);
    const sheet = page.getByRole("dialog");
    await sheet.waitFor({ timeout: 10000 }).catch(() => {});
    check("2 slipp på Kvalifisert åpner skjemaet", await sheet.isVisible());
    await sheet.getByLabel("Kort vurdering").fill("Ryddig og motivert, kan jobbe helger");
    await sheet.getByRole("button", { name: /^Flytt til Kvalifisert/ }).click();
    await sheet.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
    const landed = page.locator('[data-board-column="kvalifisert"]').getByText(name, { exact: true });
    await landed.waitFor({ timeout: 10000 }).catch(() => {});
    check("2 kortet ligger i Kvalifisert", await landed.isVisible(), name);
  } else {
    console.log("SKIP 2 ingen kandidater i Ny");
  }
  const kval = page.locator('[data-board-column="kvalifisert"] li').first();
  if (await kval.count()) {
    await keyboardDrag(page, kval, 30);
    const note = page.locator('[data-board-column="intervju-booket"]').getByText(/settes ved å booke/);
    await note.waitFor({ timeout: 10000 }).catch(() => {});
    check("3 avvist slipp forklares i kolonnen", await note.isVisible());
    check("3 vei videre: «Book intervju»", await page.locator('[data-board-column="intervju-booket"]')
      .getByRole("link", { name: "Book intervju" }).isVisible());
  } else {
    console.log("SKIP 3 ingen kandidater i Kvalifisert");
  }
  await ctx.close();
}

// 4 — the stand form on a phone.
{
  const { ctx, page } = await as(browser, "rek_promotor_pluss", 400);
  await page.goto(`${BASE}/promoter/stand`, { waitUntil: "networkidle" });
  const submit = page.getByRole("button", { name: "Registrer lead" });
  const box = await submit.boundingBox();
  check("4 knappen er ≥ 44 px høy", Boolean(box) && box.height >= 44, JSON.stringify(box));
  check("4 ingen sidelengs skroll ved 400 px",
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await submit.click();
  const summary = page.getByRole("alert").filter({ hasText: "Skjemaet må rettes" });
  check("4 tom innsending gir feilsammendrag", await summary.isVisible());
  check("4 fokus flyttes til sammendraget", await summary.evaluate((el) => el === document.activeElement));
  await page.getByLabel(/^Navn/).fill("E2E Standtest");
  await page.getByLabel(/^Telefon/).fill(`4${String(Date.now()).slice(-7)}`);
  await page.locator("#st-consent").click();
  await submit.click();
  const done = page.getByText(/E2E Standtest er registrert/);
  await done.waitFor({ timeout: 15000 }).catch(() => {});
  check("4 registrert med promotøren fra innloggingen", await done.isVisible());
  await ctx.close();
}

await browser.close();
console.log(failed ? `${failed} FEIL` : "ALLE A2-FLYTER BESTOD");
process.exitCode = failed ? 1 : 0;
