#!/usr/bin/env node
/**
 * Lists root-relative paths to upload for Vercel MCP `deploy_to_vercel` (file deploy).
 * Usage: node scripts/list-vercel-mcp-deploy-files.mjs
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const rel = relative(ROOT, abs).replaceAll("\\", "/");
    if (name === "node_modules" || name === "dist" || name === ".git") continue;
    const st = statSync(abs);
    if (st.isDirectory()) {
      walk(abs, out);
      continue;
    }
    if (rel.endsWith(".test.ts")) continue;
    if (rel.startsWith("scripts/")) continue;
    out.add(rel);
  }
}

const explicit = [
  ".vercelignore",
  "package.json",
  "bun.lock",
  "tsconfig.json",
  "vercel.json",
];

const paths = new Set(explicit);
walk(join(ROOT, "api"), paths);
walk(join(ROOT, "src"), paths);

console.log(JSON.stringify([...paths].sort(), null, 2));
