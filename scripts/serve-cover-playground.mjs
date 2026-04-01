import esbuild from "esbuild";
import { createServer } from "http";
import { mkdirSync } from "fs";
import { join, extname, normalize } from "path";
import { fileURLToPath } from "url";
import { readFile } from "fs/promises";

const rootDir = fileURLToPath(new URL("../", import.meta.url));
const distDir = join(rootDir, "dist");
mkdirSync(distDir, { recursive: true });
const buildOnly = process.argv.includes("--build-only");
const liveReloadClients = new Set();

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".yaml": "text/yaml; charset=utf-8",
};

const ctx = await esbuild.context({
  entryPoints: [join(rootDir, "src/playground/cover-playground.ts")],
  bundle: true,
  format: "esm",
  target: "es2020",
  charset: "utf8",
  sourcemap: "inline",
  outfile: join(distDir, "cover-playground.js"),
  plugins: [
    {
      name: "obsidian-browser-shim",
      setup(build) {
        build.onResolve({ filter: /^obsidian$/ }, () => ({
          path: join(rootDir, "src/playground/browser-obsidian.ts"),
        }));
        build.onEnd((result) => {
          if (result.errors.length > 0) return;
          for (const client of liveReloadClients) {
            client.write("event: reload\n");
            client.write("data: ok\n\n");
          }
        });
      },
    },
  ],
});

if (buildOnly) {
  await ctx.rebuild();
  await ctx.dispose();
  console.log(`Cover playground bundle written to ${join(distDir, "cover-playground.js")}`);
  process.exit(0);
}

await ctx.watch();

const port = 4312;
const server = createServer(async (req, res) => {
  const requestPath = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`).pathname;

  if (requestPath === "/__playground_live_reload") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    res.write("retry: 300\n\n");
    liveReloadClients.add(res);
    req.on("close", () => {
      liveReloadClients.delete(res);
      res.end();
    });
    return;
  }

  const relativePath = requestPath === "/" ? "/playground/cover/index.html" : requestPath;
  const normalizedPath = normalize(join(rootDir, relativePath));
  if (!normalizedPath.startsWith(rootDir)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const body = await readFile(normalizedPath);
    const contentType = MIME_TYPES[extname(normalizedPath)] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  }
});

server.listen(port, () => {
  console.log(`Cover playground: http://localhost:${port}/playground/cover/index.html`);
});
