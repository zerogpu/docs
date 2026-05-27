#!/usr/bin/env node
/**
 * Import Batch & Files API docs from orchestration-api/docs/batch into Mintlify MDX.
 *
 * Usage (from docs/):
 *   node scripts/import-orchestration-batch-docs.mjs
 *   ORCHESTRATION_BATCH_DOCS=../orchestration-api/docs/batch node scripts/...
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(__dirname, "..");
const defaultSource = path.resolve(docsRoot, "../orchestration-api/docs/batch");
const sourceDir = process.env.ORCHESTRATION_BATCH_DOCS || defaultSource;
const outDir = path.join(docsRoot, "api-reference", "batch");
const docsJsonPath = path.join(docsRoot, "docs.json");

const FILE_MAP = [
  ["README.md", "index.mdx"],
  ["getting-started.md", "getting-started.mdx"],
  ["files-api.md", "files-api.mdx"],
  ["batches-api.md", "batches-api.mdx"],
  ["jsonl-format.md", "jsonl-format.mdx"],
  ["supported-endpoints.md", "supported-endpoints.mdx"],
  ["examples.md", "examples.mdx"],
  ["errors.md", "errors.mdx"],
];

/** Mintlify nav order. Playground MDX pages are hand-maintained (not imported). */
const BATCH_PAGES = [
  "api-reference/batch/index",
  "api-reference/batch/getting-started",
  "api-reference/batch/upload-file",
  "api-reference/batch/list-files",
  "api-reference/batch/retrieve-file",
  "api-reference/batch/download-file",
  "api-reference/batch/delete-file",
  "api-reference/batch/files-api",
  "api-reference/batch/create-batch",
  "api-reference/batch/retrieve-batch",
  "api-reference/batch/list-batches",
  "api-reference/batch/cancel-batch",
  "api-reference/batch/batches-api",
  "api-reference/batch/jsonl-format",
  "api-reference/batch/supported-endpoints",
  "api-reference/batch/examples",
  "api-reference/batch/errors",
];

const FILES_API_PLAYGROUND_CALLOUT = `
<CardGroup cols={2}>
  <Card title="Upload file" href="/api-reference/batch/upload-file">
    \`POST /v1/files\`, attach JSONL with \`purpose=batch\`.
  </Card>
  <Card title="List files" href="/api-reference/batch/list-files">
    \`GET /v1/files\`, filter by purpose, paginate with \`after\`.
  </Card>
  <Card title="Retrieve file" href="/api-reference/batch/retrieve-file">
    \`GET /v1/files/{file_id}\`, metadata only.
  </Card>
  <Card title="Download file" href="/api-reference/batch/download-file">
    \`GET /v1/files/{file_id}/content\`, raw JSONL body.
  </Card>
  <Card title="Delete file" href="/api-reference/batch/delete-file">
    \`DELETE /v1/files/{file_id}\`, soft-delete.
  </Card>
</CardGroup>

`;

const BATCHES_API_PLAYGROUND_CALLOUT = `
<CardGroup cols={2}>
  <Card title="Create batch" href="/api-reference/batch/create-batch">
    \`POST /v1/batches\`, after you have an input file id.
  </Card>
  <Card title="Retrieve batch" href="/api-reference/batch/retrieve-batch">
    \`GET /v1/batches/{batch_id}\`, poll status and file ids.
  </Card>
  <Card title="List batches" href="/api-reference/batch/list-batches">
    \`GET /v1/batches\`, paginate with \`after\`.
  </Card>
  <Card title="Cancel batch" href="/api-reference/batch/cancel-batch">
    \`POST /v1/batches/{batch_id}/cancel\`.
  </Card>
</CardGroup>

`;

function normalizeDashes(text) {
  return text
    .replace(/ \u2014 ([a-z])/g, ", $1")
    .replace(/ \u2014 /g, ". ")
    .replace(/\u2014/g, "-")
    .replace(/\u2013/g, "-");
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '\\"');
}

function formatLinkLabel(slug) {
  const names = {
    errors: "Errors reference",
    "jsonl-format": "JSONL format",
    "supported-endpoints": "Supported endpoints",
    "files-api": "Files API",
    "batches-api": "Batches API",
    "getting-started": "Quickstart",
    examples: "Examples",
  };
  return names[slug] || slug.replace(/-/g, " ");
}

function mapHref(href) {
  if (!href) return href;
  if (href.startsWith("#/")) {
    const slug = href.slice(2).replace(/\.md$/, "");
    return `/api-reference/batch/${slug}`;
  }
  if (href.startsWith("./")) {
    return `/api-reference/batch/${href.slice(2).replace(/\.md$/, "")}`;
  }
  if (href.endsWith(".md") && !href.includes("/")) {
    return `/api-reference/batch/${href.replace(/\.md$/, "")}`;
  }
  return href;
}

function replaceCardsDivs(text) {
  const open = '<div class="cards">';
  let result = text;
  let searchFrom = 0;
  while (true) {
    const start = result.indexOf(open, searchFrom);
    if (start === -1) break;
    const contentStart = start + open.length;
    let pos = contentStart;
    let depth = 1;
    while (pos < result.length && depth > 0) {
      const nextOpen = result.indexOf("<div", pos);
      const nextClose = result.indexOf("</div>", pos);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth += 1;
        pos = nextOpen + 4;
      } else {
        depth -= 1;
        pos = nextClose + 6;
      }
    }
    const inner = result.slice(contentStart, pos - 6).trim();
    const replacement = `${convertCards(inner)}\n`;
    result = result.slice(0, start) + replacement + result.slice(pos);
    searchFrom = start + replacement.length;
  }
  return result;
}

function convertCards(inner) {
  const cards = [];
  const re =
    /<a class="card" href="([^"]+)">\s*<div class="card-title">([^<]*)<\/div>\s*<div class="card-body">([\s\S]*?)<\/div>\s*<\/a>/g;
  let m;
  while ((m = re.exec(inner))) {
    cards.push({
      href: mapHref(m[1]),
      title: m[2].trim(),
      body: m[3].trim(),
    });
  }
  if (!cards.length) return inner;
  const cols = cards.length >= 3 ? 2 : 2;
  const lines = cards.map((c) => {
    const body = c.body.replace(/<code>/g, "`").replace(/<\/code>/g, "`");
    return `  <Card title="${escapeAttr(c.title)}" href="${c.href}">\n    ${body}\n  </Card>`;
  });
  return `<CardGroup cols={${cols}}>\n${lines.join("\n")}\n</CardGroup>`;
}

function tabCodeLabel(name) {
  const n = name.trim().toLowerCase();
  if (n === "bash" || n === "curl") return "cURL";
  if (n === "python") return "Python";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function convertDocsifyTabs(text) {
  return text.replace(/<!-- tabs:start -->\n([\s\S]*?)<!-- tabs:end -->/g, (_, inner) => {
    const blocks = [];
    const sectionRe = /#### \*\*([^*]+)\*\*\s*\n+([\s\S]*?)(?=\n#### \*\*|\s*$)/g;
    let m;
    while ((m = sectionRe.exec(inner))) {
      const codeMatch = m[2].trim().match(/```(\w*)\n([\s\S]*?)```/);
      if (!codeMatch) continue;
      const lang = codeMatch[1] || "bash";
      const label = tabCodeLabel(m[1]);
      blocks.push(`\`\`\`${lang} ${label}\n${codeMatch[2].trim()}\n\`\`\``);
    }
    if (!blocks.length) return inner;
    return `<CodeGroup>\n\n${blocks.join("\n\n")}\n\n</CodeGroup>`;
  });
}

function convertCallouts(text) {
  const kindToComponent = {
    note: "Note",
    tip: "Tip",
    warning: "Warning",
    info: "Note",
  };
  return text.replace(
    /<div class="callout (\w+)">\s*<div class="callout-title">([\s\S]*?)<\/div>\s*([\s\S]*?)<\/div>/g,
    (_, kind, title, body) => {
      const component = kindToComponent[kind] || "Note";
      const cleanTitle = title
        .replace(/^[ℹ✓⚠]\s*/u, "")
        .replace(/^Note\s*-\s*/i, "")
        .trim();
      return `<${component}>\n\n**${cleanTitle}**\n\n${body.trim()}\n\n</${component}>`;
    }
  );
}

function convertMarkdownBody(raw, slug) {
  let text = raw.replace(/\r\n/g, "\n");

  // Drop Docsify-only title line; frontmatter supplies title.
  text = text.replace(/^# [^\n]+\n+/, "");
  text = text.replace(/^> [^\n]+\n+/, "");

  text = replaceCardsDivs(text);

  text = convertCallouts(text);
  text = convertDocsifyTabs(text);

  text = text.replace(
    /## <span class="verb (\w+)">(\w+)<\/span> `([^`]+)`. ([^\n]+)/g,
    "## $2 `$3`: $4"
  );
  text = text.replace(/<span class="verb \w+">(\w+)<\/span>/g, "$1");

  // Markdown links to sibling .md files (single pass to avoid duplicate URLs)
  text = text.replace(
    /\[([^\]]+)\]\(([^)]+\.md)(#[^)]*)?\)/g,
    (_, label, file, hash = "") => {
      if (file.startsWith("http")) return `[${label}](${file}${hash || ""})`;
      const slug = file.replace(/^\.\//, "").replace(/\.md$/, "");
      const textLabel = label.endsWith(".md") ? formatLinkLabel(slug) : label;
      return `[${textLabel}](/api-reference/batch/${slug}${hash || ""})`;
    }
  );
  text = text.replace(/\]\(#\/([^)]+)\)/g, (_, slugPath) => `](${mapHref(`#/${slugPath}`)})`);
  text = text.replace(
    /\]\((\/api-reference\/batch\/[^)]+)\)\(\/api-reference\/batch\/[^)]+\)/g,
    "]($1)"
  );

  // Table default cells
  text = text.replace(/\|. \|/g, "| - |");

  text = normalizeDashes(text);

  // "Response. 200 OK" became "Response. 200 OK" after dash normalization.
  text = text.replace(/### Response\. (`?\d)/g, "### Response: $1");
  text = text.replace(/### Response. /g, "### Response: ");

  if (slug === "getting-started") {
    text = text.replace(/\n## End-to-end flow[\s\S]*?(?=\n---\n\n## 1\.)/, "\n\n---\n");
  }

  if (slug === "examples") {
    text = text.replace(
      /- \*\*No cancel\*\*:[\s\S]*?abandon a\s+batch\.\n/,
      "- **`client.batches.cancel(batch_id)`**: Cancels an in-flight batch. See [Batches API](/api-reference/batch/batches-api).\n"
    );
  }

  if (slug === "files-api") {
    text = FILES_API_PLAYGROUND_CALLOUT + text;
  }

  if (slug === "batches-api") {
    text = BATCHES_API_PLAYGROUND_CALLOUT + text;
  }

  if (slug === "index") {
    text = text.replace(/\n## How it works[\s\S]*?(?=\n## Quick facts)/, "\n");
    text = text.replace(
      /The five endpoints you can target from a batch[^\n]*/i,
      "The only batchable endpoint (`/v1/chat/completions`) and its body/response shape."
    );
    text = text.replace(
      /\| \*\*Supported batch endpoints\*\* \| `\/v1\/chat\/completions`[^\n]*\|/,
      "| **Supported batch endpoint** | `/v1/chat/completions` (only) |"
    );
    text = text.replace(
      /<CardGroup cols=\{2\}>[\s\S]*?<\/CardGroup>/,
      `<CardGroup cols={2}>
  <Card title="Quickstart" href="/api-reference/batch/getting-started">
    First batch in under 10 minutes: auth, upload, create, poll, download.
  </Card>
  <Card title="Upload file (playground)" href="/api-reference/batch/upload-file">
    \`POST /v1/files\`, attach JSONL with \`purpose=batch\`.
  </Card>
  <Card title="Create batch (playground)" href="/api-reference/batch/create-batch">
    \`POST /v1/batches\` after you have an input file id.
  </Card>
  <Card title="Retrieve batch (playground)" href="/api-reference/batch/retrieve-batch">
    Poll \`GET /v1/batches/{batch_id}\` for status and output file ids.
  </Card>
  <Card title="JSONL format" href="/api-reference/batch/jsonl-format">
    Input line schema, output schema, error schema, validation rules.
  </Card>
  <Card title="Files API reference" href="/api-reference/batch/files-api">
    All five \`/v1/files\` endpoints (prose).
  </Card>
  <Card title="Batches API reference" href="/api-reference/batch/batches-api">
    Create, list, retrieve, cancel (prose).
  </Card>
  <Card title="Examples" href="/api-reference/batch/examples">
    End-to-end walkthroughs in \`curl\` and the Python \`openai\` SDK.
  </Card>
</CardGroup>`
    );
  }

  return text.trim() + "\n";
}

function extractMeta(raw, fallbackTitle) {
  const titleMatch = raw.match(/^# (.+)$/m);
  const descMatch = raw.match(/^> (.+)$/m);
  const title = titleMatch?.[1]?.trim() || fallbackTitle;
  let description = descMatch?.[1]?.trim() || "";
  description = normalizeDashes(description);
  return { title, description };
}

async function importFile(sourceName, outName) {
  const srcPath = path.join(sourceDir, sourceName);
  const raw = await readFile(srcPath, "utf8");
  const slug = outName.replace(/\.mdx$/, "");
  const { title, description } = extractMeta(raw, slug);
  const body = convertMarkdownBody(raw, slug);
  const lines = ["---", `title: "${title.replace(/"/g, '\\"')}"`];
  if (description) lines.push(`description: "${description.replace(/"/g, '\\"')}"`);
  lines.push("---", "");
  await writeFile(path.join(outDir, outName), `${lines.join("\n")}\n${body}`, "utf8");
}

async function updateDocsJson() {
  const raw = await readFile(docsJsonPath, "utf8");
  const config = JSON.parse(raw);
  const apiTab = config.navigation?.tabs?.find((t) => t.tab === "API Reference");
  if (!apiTab) throw new Error("API Reference tab not found in docs.json");

  const withoutBatch = apiTab.groups.filter((g) => g.group !== "Batch API");
  const endpointsIdx = withoutBatch.findIndex((g) => g.group === "Endpoints");
  const batchGroup = { group: "Batch API", pages: BATCH_PAGES };
  if (endpointsIdx >= 0) {
    withoutBatch.splice(endpointsIdx + 1, 0, batchGroup);
  } else {
    withoutBatch.push(batchGroup);
  }
  apiTab.groups = withoutBatch;
  await writeFile(docsJsonPath, JSON.stringify(config, null, 2) + "\n", "utf8");
}

async function main() {
  await mkdir(outDir, { recursive: true });
  for (const [src, dest] of FILE_MAP) {
    await importFile(src, dest);
    console.log(`Wrote api-reference/batch/${dest}`);
  }
  await updateDocsJson();
  console.log("Updated docs.json: API Reference → Batch API");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
