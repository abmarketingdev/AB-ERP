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
  // Whoever is still open in today's card (earlier runs may have registered some).
  const row = page.locator("li").filter({ has: page.getByRole("button", { name: "Møtt", exact: true }) }).first();
  const name = (await row.count()) ? (await row.innerText()).split("\n")[0].trim() : null;
  if (name) {
    const box = await row.getByRole("button", { name: "Møtt", exact: true }).boundingBox();
    check("1 trykkflate ≥ 44 px", Boolean(box) && box.height >= 44, JSON.stringify(box));
    await row.getByRole("button", { name: "Møtt", exact: true }).click();
    await page.waitForTimeout(1500);
  }
  const dayName = new Intl.DateTimeFormat("nb-NO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${today}T00:00:00Z`));
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (name) {
    const cell = page.getByRole("button", { name: new RegExp(`${esc(name)}.*${dayName}: Møtt`) }).first();
    check("1 leder på telefon registrerer møtt → cellen er grønn (Møtt)", await cell.count() > 0, `name=${name}`);
  } else {
    // Rerun: everyone due today is registered, and attendance is append-only — so correct
    // a day through the cell dialog instead (Ikke møtt, then back to Møtt, each with a code).
    const cellAny = page.getByRole("button", { name: new RegExp(`${dayName}: (Møtt|Ikke møtt)`) }).first();
    const before = await cellAny.getAttribute("aria-label");
    const who = before.split(",")[0];
    const flip = async (to, reason) => {
      await page.getByRole("button", { name: new RegExp(`^${esc(who)}, ${dayName}`) }).first().click();
      await page.getByLabel("Årsak hvis du retter registreringen").click();
      await page.getByRole("option", { name: reason }).click();
      await page.getByRole("button", { name: to, exact: true }).click();
      await page.waitForTimeout(1200);
      await page.keyboard.press("Escape");
    };
    const now = before.includes(": Møtt") ? "Møtt" : "Ikke møtt";
    const other = now === "Møtt" ? "Ikke møtt" : "Møtt";
    await flip(other, "Registrert feil");
    const mid = await page.getByRole("button", { name: new RegExp(`^${esc(who)}, ${dayName}`) }).first().getAttribute("aria-label");
    await flip(now, "Registrert feil");
    const after = await page.getByRole("button", { name: new RegExp(`^${esc(who)}, ${dayName}`) }).first().getAttribute("aria-label");
    check("1 leder på telefon retter oppmøte → cellen følger (append-only retting)",
      mid.includes(`: ${other}`) && after.includes(`: ${now}`), `${before} | ${mid} | ${after}`);
  }

  await ctx.close();
}

// 2 — swap end to end through the UI.
{
  const kari = await as(browser, "rek_promotor", 400);
  await kari.page.goto(`${BASE}/promoter/vaktplan`, { waitUntil: "networkidle" });
  await kari.page.getByRole("button", { name: "Neste måned" }).isVisible();
  // Kari and Jonas alternate days 12/13 ahead between runs (each run swaps them), so use
  // whichever Kari has now. Staging may hold other test swaps; every check below targets
  // this run's request by its reason text, never «the first» swap on the page.
  const fmt = (d) => new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const target = plus(12).slice(0, 7) !== today.slice(0, 7) ? plus(12) : plus(12);
  const anchorMonth = target.slice(0, 7) !== today.slice(0, 7);
  if (anchorMonth) { await kari.page.getByRole("button", { name: "Neste måned" }).click(); await kari.page.waitForTimeout(1200); }
  let dayLabel = fmt(plus(12));
  if (await kari.page.locator("li", { hasText: dayLabel }).count() === 0) dayLabel = fmt(plus(13));
  const row = kari.page.locator("li", { hasText: dayLabel }).first();
  const REASON = `Eksamen (e2e ${Date.now() % 100000})`;
  await row.getByRole("button", { name: /Be om bytte/ }).click();
  await kari.page.getByLabel("Bytt med").click();
  await kari.page.getByRole("option", { name: /Jonas/ }).first().click();
  await kari.page.getByLabel("Begrunnelse").fill(REASON);
  await kari.page.getByRole("button", { name: "Send forespørsel" }).click();
  await kari.page.waitForTimeout(1500);
  check("2a forespørsel sendt — raden viser «Bytte venter»", await kari.page.getByText("Bytte venter").count() > 0);

  const jonas = await as(browser, "rek_promotor_pluss", 400);
  await jonas.page.goto(`${BASE}/promoter/vaktplan`, { waitUntil: "networkidle" });
  const incoming = jonas.page.locator("li", { hasText: REASON });
  await incoming.getByRole("button", { name: /Ja, send til leder/ }).click();
  await incoming.waitFor({ state: "detached", timeout: 8000 }).catch(() => {});
  check("2b kollega godtar", await jonas.page.locator("li", { hasText: REASON }).count() === 0);

  const leder = await as(browser, "rek_leder", 1440);
  await leder.page.goto(`${BASE}/leder/oppmote`, { waitUntil: "networkidle" });
  const pending = leder.page.locator("li", { hasText: REASON });
  check("2c forespørselen venter hos leder etter kollegaens ja", await pending.count() === 1);
  await pending.getByRole("button", { name: "Godkjenn" }).click();
  await pending.waitFor({ state: "detached", timeout: 8000 }).catch(() => {});
  check("2c leder godkjenner", await leder.page.locator("li", { hasText: REASON }).count() === 0);

  await kari.page.reload({ waitUntil: "networkidle" });
  if (anchorMonth) { await kari.page.getByRole("button", { name: "Neste måned" }).click(); await kari.page.waitForTimeout(1200); }
  check("2d Karis vaktplan er endret (dagen er byttet bort)", await kari.page.locator("li", { hasText: dayLabel }).count() === 0);
  for (const s of [kari, jonas, leder]) await s.ctx.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
