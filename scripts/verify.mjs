// Real-browser verification: Lighthouse (mobile + desktop), axe accessibility
// scan, horizontal-overflow and ornament-fit checks, and screenshots.
// Usage: node scripts/verify.mjs                        (local site/ on a temp server)
//        node scripts/verify.mjs --lighthouse           (also run Lighthouse locally)
//        node scripts/verify.mjs https://pandaibesi.dev (live site, plus PageSpeed Insights)
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import * as chromeLauncher from "chrome-launcher";
import { serve } from "./serve.mjs";

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));
let url = process.argv.slice(2).find((a) => !a.startsWith("--")), server;
if (!url) { server = await serve(0); url = `http://localhost:${server.address().port}/`; }
const tag = url.startsWith("http://localhost") ? "local" : "live";
const out = new URL(`../reports/${tag}/`, import.meta.url).pathname;
mkdirSync(out, { recursive: true });

// CHROME_PATH lets you reuse an installed Chrome/Chromium when Playwright's own download is unavailable.
const chromePath = process.env.CHROME_PATH || chromium.executablePath();
const browser = await chromium.launch({ executablePath: chromePath });
const summary = { url, date: new Date().toISOString(), lighthouse: {}, viewports: {} };

// Layout, accessibility and screenshots per viewport.
for (const [name, viewport] of [["mobile-375", { width: 375, height: 812 }], ["mobile-320", { width: 320, height: 640 }], ["tablet-768", { width: 768, height: 1024 }], ["desktop-1440", { width: 1440, height: 900 }]]) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const layout = await page.evaluate(() => {
    const pre = [...document.querySelectorAll(".ornament pre")].find((p) => p.offsetParent !== null);
    return {
      pageOverflowX: document.documentElement.scrollWidth > window.innerWidth,
      ornament: pre ? { className: pre.className, scrollWidth: pre.scrollWidth, clientWidth: pre.clientWidth, fits: pre.scrollWidth <= pre.clientWidth + 1 } : null,
      fontsLoaded: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family),
    };
  });
  await page.addScriptTag({ content: axeSource });
  const axe = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] });
    return { violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })), passes: r.passes.length };
  });
  await page.screenshot({ path: `${out}${name}.png`, fullPage: true });
  summary.viewports[name] = { ...layout, axe };
  await page.close();
}

await browser.close();

// Lighthouse, mobile (default emulation) and desktop, each in a fresh Chrome.
// Local Lighthouse needs a quiet machine with spare RAM to give meaningful
// performance numbers, so it only runs with --lighthouse.
for (const [name, config] of flags.includes("--lighthouse") ? [["mobile", undefined], ["desktop", desktopConfig]] : []) {
  const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ["--headless=new", "--no-first-run", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] });
  const result = await lighthouse(url, { port: chrome.port, output: ["html", "json"], logLevel: "error" }, config);
  await chrome.kill();
  writeFileSync(`${out}lighthouse-${name}.html`, result.report[0]);
  const lhr = result.lhr;
  if (lhr.runtimeError) { summary.lighthouse[name] = { error: lhr.runtimeError.message }; continue; }
  summary.lighthouse[name] = {
    ...Object.fromEntries(Object.entries(lhr.categories).map(([k, v]) => [k, Math.round(v.score * 100)])),
    FCP: lhr.audits["first-contentful-paint"].displayValue,
    LCP: lhr.audits["largest-contentful-paint"].displayValue,
    CLS: lhr.audits["cumulative-layout-shift"].displayValue,
    TBT: lhr.audits["total-blocking-time"].displayValue,
    transferBytes: lhr.audits["total-byte-weight"].numericValue,
    failedAudits: Object.values(lhr.audits).filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== "informative" && a.scoreDisplayMode !== "notApplicable" && a.scoreDisplayMode !== "manual").map((a) => a.id),
  };
}

server?.close();

// For a public URL, also ask Google PageSpeed Insights, which runs Lighthouse on
// Google's own hardware. Local performance scores depend on the machine running them.
if (tag === "live") {
  summary.pagespeed = {};
  for (const strategy of ["mobile", "desktop"]) {
    const api = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
    api.searchParams.set("url", url);
    api.searchParams.set("strategy", strategy);
    for (const c of ["performance", "accessibility", "best-practices", "seo"]) api.searchParams.append("category", c);
    const res = await fetch(api);
    const body = await res.json();
    if (!res.ok) { summary.pagespeed[strategy] = { error: body.error?.message || res.status }; continue; }
    writeFileSync(`${out}pagespeed-${strategy}.json`, JSON.stringify(body));
    const lhr = body.lighthouseResult;
    summary.pagespeed[strategy] = {
      ...Object.fromEntries(Object.entries(lhr.categories).map(([k, v]) => [k, Math.round(v.score * 100)])),
      FCP: lhr.audits["first-contentful-paint"].displayValue,
      LCP: lhr.audits["largest-contentful-paint"].displayValue,
      CLS: lhr.audits["cumulative-layout-shift"].displayValue,
      TBT: lhr.audits["total-blocking-time"].displayValue,
    };
  }
}
writeFileSync(`${out}summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
