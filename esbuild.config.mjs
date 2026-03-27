import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import { existsSync, mkdirSync, copyFileSync } from "fs";
import { join } from "path";
import { execFileSync } from "child_process";

const prod = process.argv[2] === "production";

const distDir = join(import.meta.dirname, "dist");
mkdirSync(distDir, { recursive: true });

const ctx = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins,
  ],
  format: "cjs",
  target: "es2020",
  charset: "utf8",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: join(distDir, "main.js"),
  plugins: [
    {
      name: "copy-assets",
      setup(build) {
        build.onEnd(() => {
          copyFileSync("manifest.json", join(distDir, "manifest.json"));
          if (existsSync("styles.css")) {
            copyFileSync("styles.css", join(distDir, "styles.css"));
          }
          // Export schema.json for vault-side agents
          try {
            execFileSync("node", ["export-schema.mjs"], { stdio: "inherit" });
          } catch { /* non-fatal */ }
        });
      },
    },
  ],
});

if (prod) {
  await ctx.rebuild();
  process.exit(0);
} else {
  await ctx.watch();
}
