/**
 * A5 end-to-end flows in API mode against staging (08-DESIGN-REVIEW, brief §Tests):
 *   1. A leader on a phone (400 px) registers today's attendance and the cell turns green.
 *   2. Promoter asks for a swap → colleague accepts → leader approves → both schedules change.
 * Usage: BASE=http://localhost:3105 TOKENS=<dir with rek_leder, rek_promotor, rek_promotor_pluss> node e2e/a5-flows.mjs
 * Tokens are staging access tokens (one file per user). Mutates staging test data only.
 */
import { chromium } from "playwright";
import fs from "fs";

const BASE = process.env.BASE ?? "http://localhost:3105";
const tok = (u) => fs.readFileSync(`${process.env.TOKENS}/${u}`, "utf8").trim();
const today = new Date().toLocaleDateString("sv-SE");
const plus = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString("sv-SE");
let failed = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name} ${ok ? "" : extra}`); if (!ok) failed++; };

async function as(browser, user, width = 1440) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
  await ctx.addInitScript(([t]) => localStorage.setItem("ab-erp-token", t), [tok(user)]);
  return { ctx, page: await ctx.newPage() };
}

const browser = await chromium.launch();

// 1 — leader, phone width, today's card → «Møtt» → the cell for today says Møtt.
{
  const { ctx, page } = await as(browser, "rek_leder", 400);
  await page.goto(`${BASE}/leder/oppmote`, { waitUntil: "networkidle" });
  const card = page.getByRole("heading", { name: /Registrer dagens oppmøte/ });
  if (await card.count()) {
    const row = page.locator("li", { hasText: "Jonas" }).filter({ has: page.getByRole("button", { name: "Møtt" }) }).first();
    await row.getByRole("button", { name: "Møtt" }).click();
    await page.waitForTimeout(1500);
  }
  const cell = page.getByRole("button", { name: new RegExp(`Jonas.*${new Intl.DateTimeFormat("nb-NO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${today}T00:00:00Z`))}: Møtt`) }).first();
  check("1 leder på telefon registrerer møtt → cellen er grønn (Møtt)", await cell.count() > 0);
  const box = await page.getByRole("button", { name: /Møtt/ }).first().boundingBox();
  check("1 trykkflate ≥ 44 px", !box || box.height >= 44, JSON.stringify(box));
  await ctx.close();
}

// 2 — swap end to end through the UI.
{
  const kari = await as(browser, "rek_promotor", 400);
  await kari.page.goto(`${BASE}/promoter/vaktplan`, { waitUntil: "networkidle" });
  await kari.page.getByRole("button", { name: "Neste måned" }).isVisible();
  // Kari's day 12 days ahead may be next month; request from the list of own days.
  const target = plus(12);
  const anchorMonth = target.slice(0, 7) !== today.slice(0, 7);
  if (anchorMonth) { await kari.page.getByRole("button", { name: "Neste måned" }).click(); await kari.page.waitForTimeout(1200); }
  const dayLabel = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${target}T00:00:00Z`));
  const row = kari.page.locator("li", { hasText: dayLabel }).first();
  await row.getByRole("button", { name: /Be om bytte/ }).click();
  await kari.page.getByLabel("Bytt med").click();
  await kari.page.getByRole("option", { name: /Jonas/ }).first().click();
  await kari.page.getByLabel("Begrunnelse").fill("Eksamen (e2e)");
  await kari.page.getByRole("button", { name: "Send forespørsel" }).click();
  await kari.page.waitForTimeout(1500);
  check("2a forespørsel sendt — raden viser «Bytte venter»", await kari.page.getByText("Bytte venter").count() > 0);

  const jonas = await as(browser, "rek_promotor_pluss", 400);
  await jonas.page.goto(`${BASE}/promoter/vaktplan`, { waitUntil: "networkidle" });
  await jonas.page.getByRole("button", { name: /Ja, send til leder/ }).first().click();
  await jonas.page.waitForTimeout(1200);
  check("2b kollega godtar", await jonas.page.getByRole("button", { name: /Ja, send til leder/ }).count() === 0);

  const leder = await as(browser, "rek_leder", 1440);
  await leder.page.goto(`${BASE}/leder/oppmote`, { waitUntil: "networkidle" });
  await leder.page.getByRole("button", { name: "Godkjenn" }).first().click();
  await leder.page.waitForTimeout(1500);
  check("2c leder godkjenner", await leder.page.getByText(/vaktbytte venter på deg/).count() === 0
    || (await leder.page.getByText(/0 vaktbytte venter/).count()) > 0);

  await kari.page.reload({ waitUntil: "networkidle" });
  if (anchorMonth) { await kari.page.getByRole("button", { name: "Neste måned" }).click(); await kari.page.waitForTimeout(1200); }
  check("2d Karis vaktplan er endret (dagen er byttet bort)", await kari.page.locator("li", { hasText: dayLabel }).count() === 0);
  for (const s of [kari, jonas, leder]) await s.ctx.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
