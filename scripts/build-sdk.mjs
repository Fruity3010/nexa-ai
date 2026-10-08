// Builds the standalone SDK into public/sdk/ as an unversioned alias and an immutable versioned file.
import { build } from "esbuild";
import fs from "node:fs";

export const SDK_VERSION = "1.0.0";
const outdir = "public/sdk";
fs.mkdirSync(`${outdir}/v${SDK_VERSION}`, { recursive: true });

const result = await build({
  entryPoints: ["sdk/nexa.ts"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2018",
  define: { __NEXA_VERSION__: JSON.stringify(SDK_VERSION) },
  write: false,
  legalComments: "inline",
});
const code = result.outputFiles[0].contents;
fs.writeFileSync(`${outdir}/nexa.min.js`, code);
fs.writeFileSync(`${outdir}/v${SDK_VERSION}/nexa.min.js`, code);
const manifest = { version: SDK_VERSION, bytes: code.length, builtAt: new Date().toISOString(), files: ["/sdk/nexa.min.js", `/sdk/v${SDK_VERSION}/nexa.min.js`] };
fs.writeFileSync(`${outdir}/manifest.json`, JSON.stringify(manifest, null, 2));
console.log(`[nexa] SDK v${SDK_VERSION} built (${(code.length / 1024).toFixed(1)} KB) → ${outdir}/nexa.min.js, ${outdir}/v${SDK_VERSION}/nexa.min.js`);
