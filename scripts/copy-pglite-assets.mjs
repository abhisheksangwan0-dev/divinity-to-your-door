#!/usr/bin/env node
/**
 * Vercel bundles PGlite into the function's `_libs` folder but does not copy
 * the Postgres snapshot it opens at startup. Without these files the live
 * homepage throws ENOENT for `/var/task/_libs/pglite.data`.
 */
import { cpSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const srcDir = "node_modules/@electric-sql/pglite/dist";
const files = ["pglite.data", "pglite.wasm", "initdb.wasm"];
const root = ".vercel/output";

function findLibs(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (!statSync(path).isDirectory()) continue;
    if (name === "_libs") acc.push(path);
    else findLibs(path, acc);
  }
  return acc;
}

const dirs = findLibs(root);
if (dirs.length === 0) {
  console.warn("[pglite] no _libs directory — nothing to copy");
  process.exit(0);
}
for (const dir of dirs) {
  for (const file of files) {
    cpSync(join(srcDir, file), join(dir, file));
  }
  console.log(`[pglite] copied bootstrap files to ${dir}`);
}
