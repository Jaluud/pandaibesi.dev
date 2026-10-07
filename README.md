# pandaibesi.dev

One-page site for PandaiBesi Business Factory, served by GitHub Pages at
<https://pandaibesi.dev>.

The site is plain static HTML. There is no framework and no build step: what is
in `site/` is exactly what gets published. Node is only used for the optional
ornament generator and the checks.

```
site/
  index.html        the page (inline CSS, no JavaScript)
  404.html          not-found page
  fonts/            self-hosted Inter Tight and JetBrains Mono (OFL licences included)
  favicon.svg, apple-touch-icon.png, og.png
  CNAME             custom domain for GitHub Pages
scripts/
  ornament.mjs      generates the ASCII "billet to blade" ornament into index.html
  check.mjs         em-dash check, local link check, HTML validation
  verify.mjs        Lighthouse (mobile + desktop), axe, overflow checks, screenshots
  serve.mjs         local static server
COPY.md             copy deck: locked facts, what stays off the page, change log
reports/            latest verification results (local/ and live/)
.github/workflows/  deploy to GitHub Pages on every push to main
```

## Update the site

1. Edit `site/index.html` (text lives in plain HTML; styles are in the `<style>` block at the top).
2. Run the checks:
   ```bash
   npm install
   npm run check
   ```
3. Commit and push to `main`. The `Deploy to GitHub Pages` workflow publishes `site/` in about a minute.

Rules for copy, also enforced by `npm run check` where possible:

- Only facts from the PandaiBesi Business Factory SSOT. No invented products, customers, numbers or results.
- Never use em dashes.
- Organization voice ("we", "PandaiBesi"). No headcount, no team claims.

## Preview locally

```bash
npm run serve
```

Then open <http://localhost:8080>.

## Change the ornament

The ornament is generated, not drawn. Tweak the geometry constants at the top
of `scripts/ornament.mjs` (`BILLET`, `DRAWN`, `TIP`, thickness, lighting), then:

```bash
npm run ornament
```

`node scripts/ornament.mjs --print 150` prints a preview to the terminal
without touching the page. Two sizes are written: 150 columns for wide screens
and 84 columns for phones. Both scale to the container width with CSS
container query units, so they never cause horizontal scrolling.

## Verify

```bash
npm run verify
npm run verify -- https://pandaibesi.dev
```

This runs an axe-core WCAG 2.2 AA scan at 320, 375, 768 and 1440 px widths,
checks for horizontal overflow and that the ornament fits, and saves screenshots
and a `summary.json` in `reports/local/` or `reports/live/`. For the live URL it
also fetches Google PageSpeed Insights (Lighthouse on Google's hardware, mobile
and desktop). Add `--lighthouse` to also run Lighthouse locally; local
performance scores depend on how busy the machine is.

It uses Playwright's Chromium. If Playwright cannot download a browser for your
OS, point it at an existing Chrome or Chromium:

```bash
CHROME_PATH=/path/to/chrome npm run verify
```

## Hosting and DNS

- Host: GitHub Pages, repository `Jaluud/pandaibesi.dev`, deployed by GitHub Actions from `site/`.
- DNS: Cloudflare (zone `pandaibesi.dev`). Records must be **DNS only** (grey cloud) so GitHub can issue the HTTPS certificate.

| Type | Name | Content |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |
| CNAME | `www` | `jaluud.github.io` |
| TXT | `_github-pages-challenge-Jaluud` | value from GitHub, Settings, Pages, Verified domains |

`www.pandaibesi.dev` redirects to `pandaibesi.dev` automatically once both
records resolve. `.dev` domains only work over HTTPS, so the site is not
reachable until GitHub has issued the certificate and "Enforce HTTPS" is on.

## Contact address

The page links to `ottmar@pandaibesi.dev`. The site does not send or receive
mail itself. For mail to arrive, the address needs a mailbox or a forward, for
example Cloudflare Email Routing (Cloudflare dashboard, Email, Email Routing),
forwarding to a private inbox. Email Routing adds its own MX and TXT records;
they do not conflict with the Pages records above.
