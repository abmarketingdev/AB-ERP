import { chromium } from "playwright";
const OUT = process.env.OUT;
const browser = await chromium.launch();

const ROUTES = {
  promoter: { email: "kari@abmarketing.no", pw: "promoter123", land: /promoter/, routes:
    ["/promoter", "/promoter/resultater", "/promoter/ukeplan", "/promoter/mal", "/promoter/kurs", "/promoter/nyheter"] },
  leder: { email: "ola@abmarketing.no", pw: "leder123", land: /\/leder/, routes:
    ["/leder", "/leder/teamresultater", "/leder/oppfolging", "/leder/tiltak", "/leder/mal", "/leder/kurs", "/leder/person/p5"] },
  saleschief: { email: "marte@abmarketing.no", pw: "salgssjef123", land: /\/leder/, routes:
    ["/leder", "/leder/team", "/leder/mal"] },
  rekruttering: { email: "fredrik@abmarketing.no", pw: "rekrutt123", land: /rekruttering/, routes:
    ["/rekruttering", "/rekruttering/kandidater", "/rekruttering/kandidater/c1"] },
  admin: { email: "admin@abmarketing.no", pw: "admin123", land: /\/admin/, routes:
    ["/admin", "/admin/kpi-ordbok", "/admin/import", "/admin/integrasjoner", "/admin/korrigeringer",
     "/admin/tilganger", "/admin/kunder", "/admin/forhandsvis", "/admin/revisjonslogg"] },
};

/** Layout problems that are easy to miss by eye and never acceptable. */
const AUDIT = () => {
  const vw = window.innerWidth;
  const inMain = (e) => e.closest("main");
  const vis = (e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const floor = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 640 ? 44 : 24;
  const smallTargets = [...document.querySelectorAll("main button, main a, main [role='tab']")]
    .filter(vis)
    .filter((e) => e.getBoundingClientRect().height < floor)
    .map((e) => `${(e.textContent || "").trim().slice(0, 22)}@${Math.round(e.getBoundingClientRect().height)}px`);

  // elements whose text is clipped by a fixed-height ancestor
  const clipped = [...document.querySelectorAll("main *")]
    .filter((e) => {
      // `sr-only` is a 1px clipped box on purpose — that is how it hides text
      // from sight while keeping it for a screen reader.
      const r0 = e.getBoundingClientRect();
      if (r0.width <= 2 || r0.height <= 2) return false;
      if (!vis(e) || e.scrollWidth <= e.clientWidth + 2) return false;
      const cs = getComputedStyle(e);
      if (cs.overflowX !== "hidden") return false;
      // An ellipsis or a clamp is a deliberate choice, not a defect.
      return cs.textOverflow !== "ellipsis" && cs.webkitLineClamp === "none";
    })
    .map((e) => (e.textContent || "").trim().slice(0, 30))
    .filter(Boolean);

  // any two interactive elements that visually overlap
  const boxes = [...document.querySelectorAll("main button, main a")].filter(vis).map((e) => ({
    t: (e.textContent || "").trim().slice(0, 18),
    r: e.getBoundingClientRect(),
  }));
  const overlaps = [];
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].r, b = boxes[j].r;
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 6 && oy > 6) overlaps.push(`${boxes[i].t} / ${boxes[j].t}`);
    }

  return {
    hScroll: document.documentElement.scrollWidth > vw + 1,
    smallTargets: [...new Set(smallTargets)].slice(0, 4),
    clipped: [...new Set(clipped)].slice(0, 3),
    overlaps: [...new Set(overlaps)].slice(0, 3),
    mainH: Math.round(document.querySelector("main")?.getBoundingClientRect().height ?? 0),
    contentH: Math.round(document.querySelector("main")?.scrollHeight ?? 0),
  };
};

const problems = [];

for (const [role, cfg] of Object.entries(ROUTES)) {
  for (const [device, viewport, isMobile] of [
    ["desk", { width: 1500, height: 1100 }, false],
    ["mob", { width: 390, height: 844 }, true],
  ]) {
    const ctx = await browser.newContext({ viewport, isMobile, hasTouch: isMobile });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message.slice(0, 90)));
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 90)); });

    await page.goto("http://localhost:3000/login");
    await page.waitForSelector("#email", { timeout: 25000 });
    await page.fill("#email", cfg.email); await page.fill("#password", cfg.pw);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1800);
    if (/kode|tofaktor/i.test(await page.textContent("body"))) {
      await page.locator("input").last().fill("123456");
      await page.click('button[type="submit"]');
    }
    await page.waitForURL(cfg.land, { timeout: 25000 });

    for (const route of cfg.routes) {
      await page.goto(`http://localhost:3000${route}`);
      await page.waitForTimeout(2600);
      const name = `${device}-${route.replace(/\//g, "_").replace(/^_/, "")}`;
      await page.screenshot({ path: `${OUT}/sweep/${name}.png`, fullPage: true });
      const a = await page.evaluate(AUDIT);
      const issues = [];
      if (a.hScroll) issues.push("H-SCROLL");
      if (a.smallTargets.length) issues.push(`TAP: ${a.smallTargets.join(", ")}`);
      if (a.clipped.length) issues.push(`CLIPPED: ${a.clipped.join(" | ")}`);
      if (a.overlaps.length) issues.push(`OVERLAP: ${a.overlaps.join(" | ")}`);
      if (errs.length) issues.push(`ERR: ${[...new Set(errs)][0]}`);
      if (issues.length) problems.push(`${device.padEnd(4)} ${route.padEnd(34)} ${issues.join("  ·  ")}`);
      errs.length = 0;
    }
    await ctx.close();
  }
}

// customer portal
{
  for (const [device, viewport, isMobile] of [["desk", { width: 1400, height: 1000 }, false], ["mob", { width: 390, height: 844 }, true]]) {
    const ctx = await browser.newContext({ viewport, isMobile, hasTouch: isMobile });
    const page = await ctx.newPage();
    await page.goto("http://localhost:3000/kunde/login");
    await page.waitForTimeout(2000);
    await page.locator('input[type="email"], #c-email').first().fill("kontakt@rodekors.no");
    await page.locator('input[type="password"]').fill("kunde123");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    await page.locator("input").last().fill("246810");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3200);
    await page.screenshot({ path: `${OUT}/sweep/${device}-kunde.png`, fullPage: true });
    const a = await page.evaluate(AUDIT);
    const issues = [];
    if (a.hScroll) issues.push("H-SCROLL");
    if (a.smallTargets.length) issues.push(`TAP: ${a.smallTargets.join(", ")}`);
    if (a.overlaps.length) issues.push(`OVERLAP: ${a.overlaps.join(" | ")}`);
    if (issues.length) problems.push(`${device.padEnd(4)} ${"/kunde/rapport".padEnd(34)} ${issues.join("  ·  ")}`);
    await ctx.close();
  }
}

console.log("DESIGN SWEEP — every screen, desktop + mobile\n");
if (!problems.length) console.log("  no layout problems found");
for (const p of problems) console.log("  " + p);
console.log(`\n${problems.length} screens with issues`);
await browser.close();
