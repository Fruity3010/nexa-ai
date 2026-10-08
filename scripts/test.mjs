// Unit/integration tests: `npm test`. Bundles tests/*.test.ts with esbuild (resolves the @/ alias,
// stubs Next's "server-only" marker) and runs them with node:test. No network, no provider costs.
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const files = fs.readdirSync("tests").filter((f) => f.endsWith(".test.ts")).map((f) => `tests/${f}`);
await build({
  entryPoints: files, outdir: ".test", bundle: true, platform: "node", format: "esm", packages: "external", outExtension: { ".js": ".mjs" }, logLevel: "warning",
  plugins: [{ name: "server-only", setup(b) {
    b.onResolve({ filter: /^server-only$/ }, () => ({ path: "server-only", namespace: "stub" }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "" }));
  } }],
});
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "nexa-test-"));
// Strip provider credentials so nothing can reach a paid API.
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(TWILIO_|GEMINI_|ANTHROPIC_|VOICE_|NEXA_)/.test(k)));
const r = spawnSync(process.execPath, ["--test", ...files.map((f) => `.test/${path.basename(f, ".ts")}.mjs`)], { stdio: "inherit", env: { ...env, NEXA_DATA_DIR: dataDir } });
fs.rmSync(dataDir, { recursive: true, force: true });
process.exit(r.status ?? 1);
