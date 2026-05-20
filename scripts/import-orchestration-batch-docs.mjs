#!/usr/bin/env node
/**
 * Import batch API docs from orchestration-api/docs/batch into Mintlify MDX.
 * Source: ../orchestration-api/docs/batch (relative to docs repo root).
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const docsRoot = process.cwd();
const sourceDir = path.resolve(docsRoot, "../orchestration-api/docs/batch");
const outDir = path.join(docsRoot, "api-reference/batch");

const FILES = [
  ["README.md", "index.mdx"],
  ["getting-started.md", "getting-started.mdx"],
  ["files-api.md", "files-api.mdx"],
  ["batches-api.md", "batches-api.mdx"],
  ["jsonl-format.md", "jsonl-format.mdx"],
  ["supported-endpoints.md", "supported-endpoints.mdx"],
  ["examples.md", "examples.mdx"],
  ["errors.md", "errors.mdx"],
];

function slugFromFilename(name) {
  return name.replace(/\.mdx?$/, "").replace(/^README$/i, "index");
}

function extractFrontmatter(md) {
  const lines = md.split("\n");
  let title = "Batch API";
  let description = "";
  for (const line of lines) {
    if (line.startsWith("# ")) {
      title = line.slice(2).trim();
      break;
    }
  }
  for (const line of lines) {
    if (line.startsWith("> ")) {
      description = line.slice(2).trim();
      break;
    }
  }
  return { title, description };
}

function stripTitleBlockquote(md) {
  const lines = md.split("\n");
  let i = 0;
  if (lines[i]?.startsWith("# ")) i++;
  if (lines[i]?.trim() === "") i++;
  if (lines[i]?.startsWith("> ")) i++;
  if (lines[i]?.trim() === "") i++;
  return lines.slice(i).join("\n");
}

function convertCards(html) {
  const cards = [
    ...html.matchAll(
      /<a class="card" href="([^"]+)">\s*<div class="card-title">([^<]*)<\/div>\s*<div class="card-body">([\s\S]*?)<\/div>\s*<\/a>/g
    ),
  ];
  if (!cards.length) return html;
  const items = cards
    .map(([, href, title, body]) => {
      const cleanHref = href.replace(/^#\//, "/api-reference/batch/");
      const cleanTitle = title.trim().replace(/\s*→\s*$/, "");
      const cleanBody = body
        .trim()
        .replace(/<\/?code>/g, "`")
        .replace(/\s+/g, " ");
      return `  <Card title="${cleanTitle}" href="${cleanHref}">\n    ${cleanBody}\n  </Card>`;
    })
    .join("\n");
  return `<CardGroup cols={2}>\n${items}\n</CardGroup>\n\n`;
}

function convertCardsBlocks(md) {
  const patterns = [
    /<div class="cards">([\s\S]*?)<\/div>\n\n(?=## )/g,
    /<div class="cards">([\s\S]*?)<\/div>\s*$/g,
  ];
  let s = md;
  for (const pattern of patterns) {
    s = s.replace(pattern, (_, inner) => convertCards(inner));
  }
  return s;
}

function convertCallout(md) {
  return md.replace(
    /<div class="callout (\w+)">\s*<div class="callout-title">([\s\S]*?)<\/div>\s*([\s\S]*?)<\/div>/g,
    (_, kind, title, body) => {
      const cleanTitle = title.trim().replace(/<\/?code>/g, "`");
      const cleanBody = body
        .trim()
        .replace(/<\/?code>/g, "`")
        .replace(/<a href="([^"]+)">([^<]*)<\/a>/g, "[$2]($1)");
      const tag = kind === "warning" ? "Warning" : kind === "tip" ? "Tip" : "Note";
      return `<${tag}>\n**${cleanTitle}**\n\n${cleanBody}\n</${tag}>`;
    }
  );
}

function convertTabs(md) {
  return md.replace(/<!-- tabs:start -->([\s\S]*?)<!-- tabs:end -->/g, (_, block) => {
    const sections = [...block.matchAll(/#### \*\*([^*]+)\*\*\s*\n+([\s\S]*?)(?=\n#### \*\*|\s*$)/g)];
    if (!sections.length) return block;
    const parts = sections.map(([, label, body]) => {
      const trimmed = body.trim();
      const codeMatch = trimmed.match(/^```[\w]*\n([\s\S]*?)```$/);
      if (!codeMatch) return trimmed;
      const code = codeMatch[1].trimEnd();
      if (/python/i.test(label)) return `\`\`\`python Python\n${code}\n\`\`\``;
      if (/curl/i.test(label)) return `\`\`\`bash cURL\n${code}\n\`\`\``;
      return `\`\`\`bash bash\n${code}\n\`\`\``;
    });
    return `<CodeGroup>\n\n${parts.join("\n\n")}\n\n</CodeGroup>`;
  });
}

function convertLinks(md) {
  return md
    .replace(/#\/([a-z0-9-]+)/gi, "/api-reference/batch/$1")
    .replace(/\]\(\.\/([a-z0-9-]+)\.md([^)]*)\)/gi, "](/api-reference/batch/$1$2)");
}

function convertVerbs(md) {
  return md
    .replace(/<span class="verb \w+">(\w+)<\/span>/g, "$1")
    .replace(/## (POST|GET|DELETE) /g, "## $1 ");
}

function convertContent(md) {
  let s = md;
  s = convertVerbs(s);
  s = convertLinks(s);
  s = convertCallout(s);
  s = convertCardsBlocks(s);
  s = convertTabs(s);
  return s;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  for (const [srcName, outName] of FILES) {
    const raw = await readFile(path.join(sourceDir, srcName), "utf8");
    const { title, description } = extractFrontmatter(raw);
    const body = convertContent(stripTitleBlockquote(raw));
    const mdx = `---\ntitle: "${title.replace(/"/g, '\\"')}"\ndescription: "${description.replace(/"/g, '\\"')}"\n---\n\n${body}`;
    const outPath = path.join(outDir, outName);
    await writeFile(outPath, mdx, "utf8");
    console.log("Wrote", path.relative(docsRoot, outPath));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
