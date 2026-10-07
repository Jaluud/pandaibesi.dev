// Content and markup checks. Fails on em dashes, en dashes used as dashes,
// broken local references and invalid HTML.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const site = new URL("../site/", import.meta.url).pathname;
const files = ["README.md", "COPY.md", ...readdirSync(site).filter((f) => /\.(html|txt|xml|svg)$/.test(f)).map((f) => join("site", f))];
let failed = false;

for (const f of files) {
  const text = readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
  text.split("\n").forEach((line, i) => {
    if (line.includes("—")) { console.error(`${f}:${i + 1}: em dash found`); failed = true; }
  });
}

const html = readFileSync(join(site, "index.html"), "utf8");
for (const [, ref] of html.matchAll(/(?:href|src)="\/([^"#?]*)"/g)) {
  if (ref && !existsSync(join(site, ref))) { console.error(`index.html: missing local file /${ref}`); failed = true; }
}

try { execSync("npx html-validate site/*.html", { stdio: "inherit" }); }
catch { failed = true; }

if (failed) process.exit(1);
console.log("check passed: no em dashes, local references resolve, HTML valid");
