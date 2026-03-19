import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import { existsSync, mkdirSync, copyFileSync } from "fs";
import { join } from "path";

const prod = process.argv[2] === "production";

// Output to vault's plugin directory
const vaultPluginDir = join(
  process.env.HOME,
  "projects/obsidian-knowledge/.obsidian/plugins/note-renderer"
);

if (!existsSync(vaultPluginDir)) {
  mkdirSync(vaultPluginDir, { recursive: true });
}

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
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: join(vaultPluginDir, "main.js"),
  plugins: [
    {
      name: "copy-assets",
      setup(build) {
        build.onEnd(() => {
          copyFileSync("manifest.json", join(vaultPluginDir, "manifest.json"));
          if (existsSync("styles.css")) {
            copyFileSync("styles.css", join(vaultPluginDir, "styles.css"));
          }
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
