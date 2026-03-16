#!/usr/bin/env node
/**
 * compile-packs.mjs — Compiles _source/ JSON files into LevelDB compendium packs
 *
 * Usage:
 *   1. cd into this module directory
 *   2. npm install @foundryvtt/foundryvtt-cli
 *   3. node compile-packs.mjs
 *
 * This reads module.json to discover all packs and compiles each one.
 */

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { resolve, join } from "path";

const MODULE_DIR = resolve(import.meta.dirname || ".");
const MODULE_JSON = join(MODULE_DIR, "module.json");

if (!existsSync(MODULE_JSON)) {
  console.error("❌ module.json not found. Run this script from the module root directory.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MODULE_JSON, "utf-8"));
const packs = manifest.packs || [];

if (packs.length === 0) {
  console.error("❌ No packs found in module.json");
  process.exit(1);
}

console.log(`📦 Compiling ${packs.length} packs for "${manifest.title}"...\n`);

let success = 0;
let failed = 0;

for (const pack of packs) {
  const packPath = join(MODULE_DIR, pack.path);
  const sourcePath = join(packPath, "_source");

  if (!existsSync(sourcePath)) {
    console.warn(`⚠️  Skipping "${pack.label}" — no _source/ directory at ${sourcePath}`);
    failed++;
    continue;
  }

  console.log(`  📄 Compiling "${pack.label}" (${pack.name})...`);

  try {
    execSync(
      `npx fvtt package pack "${pack.name}" --type "Module" --id "${manifest.id}" --in "${sourcePath}" --out "${packPath}"`,
      { cwd: MODULE_DIR, stdio: "pipe" }
    );
    console.log(`  ✅ "${pack.label}" compiled successfully`);
    success++;
  } catch (err) {
    console.error(`  ❌ "${pack.label}" failed: ${err.stderr?.toString() || err.message}`);
    failed++;
  }
}

console.log(`\n📊 Results: ${success} compiled, ${failed} failed out of ${packs.length} total`);
if (failed > 0) process.exit(1);
