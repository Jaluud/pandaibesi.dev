// Minimal static server for site/ (local preview and verification only).
import { createServer } from "node:http";
import { gzipSync } from "node:zlib";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../site/", import.meta.url));
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml",
  ".png": "image/png", ".woff2": "font/woff2", ".txt": "text/plain", ".xml": "application/xml" };

export function serve(port = Number(process.env.PORT) || 8080) {
  const server = createServer(async (req, res) => {
    let path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
    let file = join(root, path);
    try { if ((await stat(file)).isDirectory()) file = join(file, "index.html"); }
    catch { file = join(root, "404.html"); res.statusCode = 404; }
    try {
      let body = await readFile(file);
      const type = types[extname(file)] || "application/octet-stream";
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", type);
      // Roughly what GitHub Pages does: gzip text and a short cache lifetime.
      res.setHeader("Cache-Control", "max-age=600");
      if (/text|svg|xml/.test(type) && /gzip/.test(req.headers["accept-encoding"] || "")) {
        body = gzipSync(body);
        res.setHeader("Content-Encoding", "gzip");
      }
      res.end(body);
    } catch { res.statusCode = 404; res.end("Not found"); }
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const s = await serve();
  console.log(`Serving site/ on http://localhost:${s.address().port}`);
}
