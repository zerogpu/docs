#!/usr/bin/env node
/**
 * Replace em dash (U+2014) and en dash (U+2013) with ASCII hyphen/comma across the docs repo.
 * Run from docs/: node scripts/normalize-dashes.mjs
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  ".venv",
  "__pycache__",
  "site-packages",
]);
const TEXT_EXT = new Set([
  ".md",
  ".mdx",
  ".mjs",
  ".js",
  ".json",
  ".jsonl",
  ".txt",
  ".css",
  ".yml",
  ".yaml",
]);

function normalizeDashes(text) {
  return text
    .replace(/ \u2014 /g, ", ")
    .replace(/\u2014/g, "-")
    .replace(/\u2013/g, "-");
}

async function walk(dir, changed) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      await walk(full, changed);
      continue;
    }
    const ext = path.extname(ent.name);
    if (!TEXT_EXT.has(ext)) continue;
    const raw = await readFile(full, "utf8");
    const next = normalizeDashes(raw);
    if (next !== raw) {
      await writeFile(full, next);
      changed.push(path.relative(docsRoot, full));
    }
  }
}

const changed = [];
await walk(docsRoot, changed);
if (changed.length === 0) {
  console.log("No em/en dashes found.");
} else {
  console.log(`Updated ${changed.length} file(s):`);
  for (const f of changed) console.log(`  ${f}`);
}
