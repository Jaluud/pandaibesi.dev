// Renders og.png (1200x630) and apple-touch-icon.png (180x180) from HTML,
// using the site's own fonts and ornament. Run after changing the headline or ornament.
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { serve } from "./serve.mjs";

const server = await serve(0);
const base = `http://localhost:${server.address().port}`;
const html = readFileSync(new URL("../site/index.html", import.meta.url), "utf8");
const wide = html.match(/<!-- ornament:wide -->([\s\S]*?)<!-- \/ornament:wide -->/)[1];

const og = `<!doctype html><html><head><meta charset="utf-8"><base href="${base}/"><style>
@font-face{font-family:"Inter Tight";src:url(fonts/inter-tight.woff2) format("woff2");font-weight:100 900}
@font-face{font-family:"JetBrains Mono";src:url(fonts/jetbrains-mono.woff2) format("woff2")}
body{margin:0;width:1200px;height:630px;background:#ECE8DF;color:#14130F;font-family:"Inter Tight";display:flex;flex-direction:column;justify-content:space-between;padding:56px 64px 40px;box-sizing:border-box}
.top{display:flex;justify-content:space-between;font:400 18px "JetBrains Mono";letter-spacing:.2em}
.top b{font-weight:400;color:#A8360B}
h1{font-weight:600;font-size:66px;line-height:.98;letter-spacing:-.035em;margin:0;max-width:1000px}
pre{margin:0;font:400 calc(1072px / 90) / 1 "JetBrains Mono";font-feature-settings:"calt" 0,"liga" 0;color:#5E4636;white-space:pre}
pre .code{color:#A8360B}
</style></head><body>
<div class="top"><span><b>///</b> PANDAIBESI</span><span>pandaibesi.dev</span></div>
<h1>From iron to software, useful things are made the same way: shaped, tested, refined.</h1>
<pre>${wide}</pre></body></html>`;

const icon = `<!doctype html><html><body style="margin:0">
<img src="${base}/favicon.svg" width="180" height="180" style="display:block"></body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(og, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: new URL("../site/og.png", import.meta.url).pathname });
await page.setViewportSize({ width: 180, height: 180 });
await page.setContent(icon, { waitUntil: "networkidle" });
await page.screenshot({ path: new URL("../site/apple-touch-icon.png", import.meta.url).pathname });
await browser.close();
server.close();
console.log("wrote site/og.png and site/apple-touch-icon.png");
