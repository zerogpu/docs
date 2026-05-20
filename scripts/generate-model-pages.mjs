#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const MODELS_ENDPOINT = "https://api-dashboard.zerogpu.ai/api/models";
const projectRoot = process.cwd();
const docsRoot = path.join(projectRoot);
const modelsDir = path.join(docsRoot, "models");
const fallbackPath = path.join(docsRoot, "snippets", "model-catalog-fallback.json");
const playgroundsManifestPath = path.join(docsRoot, "snippets", "model-playgrounds.json");

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function nonEmptyString(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function fmtMoney(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return `$${value.toFixed(2)} / 1M`;
}

function resolveTotalPer1mTokens(pricing) {
  const p = pricing || {};
  if (typeof p.total_per_1m_tokens === "number" && !Number.isNaN(p.total_per_1m_tokens)) {
    return p.total_per_1m_tokens;
  }
  const input = p.input_per_1m_tokens;
  const output = p.output_per_1m_tokens;
  if (
    typeof input === "number" &&
    typeof output === "number" &&
    !Number.isNaN(input) &&
    !Number.isNaN(output)
  ) {
    return input + output;
  }
  return NaN;
}

function inferProviderFromModel(model) {
  const p = model.pricing || {};
  const urls = [];
  if (p.model_doc_url) urls.push(String(p.model_doc_url));
  if (p.terms_url) urls.push(String(p.terms_url));
  if (p.privacy_service) urls.push(String(p.privacy_service));
  for (const u of urls) {
    try {
      const h = new URL(u).hostname.toLowerCase();
      if (h.includes("liquid.ai")) return "Liquid AI";
      if (h.includes("zerogpu")) return "ZeroGPU";
      if (h.includes("microsoft") || h.includes("azure")) return "Microsoft";
      if (h.includes("google") || h.includes("vertex")) return "Google";
      if (h.includes("huggingface")) return "Hugging Face";
      if (h.includes("openai")) return "OpenAI";
      if (h.includes("meta.") || h.includes("llama")) return "Meta";
      if (h.includes("github.com")) {
        const ghPath = new URL(u).pathname.toLowerCase();
        if (ghPath.includes("/microsoft/")) return "Microsoft";
        if (ghPath.includes("/google")) return "Google";
        if (ghPath.includes("/meta-llama/") || ghPath.includes("/facebookresearch/"))
          return "Meta";
        if (ghPath.includes("/openai/")) return "OpenAI";
      }
    } catch {
      /* ignore invalid URL */
    }
  }
  return null;
}

function resolveProviderDisplay(model) {
  const direct = model.cloudProvider;
  if (direct != null && String(direct).trim() !== "") return String(direct);
  return inferProviderFromModel(model);
}

function escapeMdxInline(value) {
  const s = nonEmptyString(value);
  if (!s) return "";
  return s.replace(/\|/g, "\\|");
}

function toPrettyJson(value) {
  return JSON.stringify(value, null, 2);
}

function shellEscapeSingleQuoted(value) {
  return String(value).replace(/'/g, "'\"'\"'");
}

function renderCurlSnippet(endpointPath, payload) {
  const payloadJson = toPrettyJson(payload);
  return [
    `curl --location 'https://api.zerogpu.ai${endpointPath}' \\`,
    "  --header 'content-type: application/json' \\",
    "  --header 'x-api-key: YOUR_API_KEY' \\",
    "  --header 'x-project-id: YOUR_PROJECT_ID' \\",
    `  --data '${shellEscapeSingleQuoted(payloadJson)}'`,
  ].join("\n");
}

function renderPythonSnippet(endpointPath, payload) {
  const payloadJson = toPrettyJson(payload);
  return [
    "import requests",
    "import json",
    "",
    `url = "https://api.zerogpu.ai${endpointPath}"`,
    "headers = {",
    '    "content-type": "application/json",',
    '    "x-api-key": "YOUR_API_KEY",',
    '    "x-project-id": "YOUR_PROJECT_ID",',
    "}",
    `payload = json.loads("""${payloadJson}""")`,
    "",
    "response = requests.post(url, headers=headers, json=payload)",
    "print(response.json())",
  ].join("\n");
}

function renderJavaScriptSnippet(endpointPath, payload) {
  const payloadJson = toPrettyJson(payload);
  return [
    `const url = 'https://api.zerogpu.ai${endpointPath}';`,
    "const headers = {",
    "  'content-type': 'application/json',",
    "  'x-api-key': 'YOUR_API_KEY',",
    "  'x-project-id': 'YOUR_PROJECT_ID'",
    "};",
    `const payload = ${payloadJson};`,
    "",
    "fetch(url, {",
    "  method: 'POST',",
    "  headers,",
    "  body: JSON.stringify(payload)",
    "})",
    "  .then(response => response.json())",
    "  .then(data => console.log(data))",
    "  .catch(error => console.error('Error:', error));",
  ].join("\n");
}

function renderRustSnippet(endpointPath, payload) {
  const payloadJson = toPrettyJson(payload);
  return [
    "use reqwest::Client;",
    "use serde_json::Value;",
    "",
    "#[tokio::main]",
    "async fn main() -> Result<(), Box<dyn std::error::Error>> {",
    "    let client = Client::new();",
    "",
    '    let payload: Value = serde_json::from_str(r#"',
    payloadJson,
    '"#)?;',
    "",
    "    let response = client",
    `        .post("https://api.zerogpu.ai${endpointPath}")`,
    '        .header("content-type", "application/json")',
    '        .header("x-api-key", "YOUR_API_KEY")',
    '        .header("x-project-id", "YOUR_PROJECT_ID")',
    "        .json(&payload)",
    "        .send()",
    "        .await?;",
    "",
    "    let body = response.text().await?;",
    '    println!("{}", body);',
    "    Ok(())",
    "}",
  ].join("\n");
}

function renderGoSnippet(endpointPath, payload) {
  const payloadJson = toPrettyJson(payload);
  return [
    "package main",
    "",
    "import (",
    '  "bytes"',
    '  "fmt"',
    '  "io"',
    '  "net/http"',
    ")",
    "",
    "func main() {",
    `  url := "https://api.zerogpu.ai${endpointPath}"`,
    "",
    "  payloadBytes := []byte(`" + payloadJson + "`)",
    "",
    '  req, err := http.NewRequest("POST", url, bytes.NewBuffer(payloadBytes))',
    "  if err != nil {",
    "    panic(err)",
    "  }",
    "",
    '  req.Header.Set("content-type", "application/json")',
    '  req.Header.Set("x-api-key", "YOUR_API_KEY")',
    '  req.Header.Set("x-project-id", "YOUR_PROJECT_ID")',
    "",
    "  client := &http.Client{}",
    "  res, err := client.Do(req)",
    "  if err != nil {",
    "    panic(err)",
    "  }",
    "  defer res.Body.Close()",
    "",
    "  body, _ := io.ReadAll(res.Body)",
    "  fmt.Println(string(body))",
    "}",
  ].join("\n");
}

function renderRubySnippet(endpointPath, payload) {
  const payloadJson = toPrettyJson(payload);
  return [
    "require 'net/http'",
    "require 'uri'",
    "",
    `uri = URI.parse('https://api.zerogpu.ai${endpointPath}')`,
    "http = Net::HTTP.new(uri.host, uri.port)",
    "http.use_ssl = (uri.scheme == 'https')",
    "",
    "request = Net::HTTP::Post.new(uri.request_uri)",
    "request['content-type'] = 'application/json'",
    "request['x-api-key'] = 'YOUR_API_KEY'",
    "request['x-project-id'] = 'YOUR_PROJECT_ID'",
    "",
    "request.body = <<~'JSON'",
    payloadJson,
    "JSON",
    "",
    "response = http.request(request)",
    "puts response.body",
  ].join("\n");
}

function buildMdx(model, playgroundsManifest) {
  const pricing = model.pricing || {};
  const modelId = nonEmptyString(model.modelId) || "unknown";
  const title = nonEmptyString(model.modelDisplayName) || modelId;
  const description = nonEmptyString(pricing.description);
  const task = nonEmptyString(model.taskDisplayName || model.taskType);
  const modelType = nonEmptyString(model.modelType);
  const parameters = nonEmptyString(model.parameters);
  const version = nonEmptyString(model.modelVersion);
  const maxTokens = nonEmptyString(model.maxTokens);
  const provider = resolveProviderDisplay(model);
  const inputPrice = fmtMoney(pricing.input_per_1m_tokens);
  const outputPrice = fmtMoney(pricing.output_per_1m_tokens);
  const totalPrice = fmtMoney(resolveTotalPer1mTokens(pricing));
  const references = [];
  if (pricing.model_doc_url) references.push(`[Model docs](${pricing.model_doc_url})`);
  if (pricing.terms_url) references.push(`[Terms](${pricing.terms_url})`);
  if (pricing.privacy_service) references.push(`[Privacy](${pricing.privacy_service})`);

  const lead = [];
  if (description) lead.push(`> ${escapeMdxInline(description)}`);
  if (references.length > 0) lead.push(`**References:** ${references.join(" • ")}`);

  const specLines = [
    "| Property | Value |",
    "| --- | --- |",
    `| Model ID | \`${escapeMdxInline(modelId)}\` |`,
  ];
  if (task) specLines.push(`| Task | ${escapeMdxInline(task)} |`);
  if (modelType) specLines.push(`| Type | \`${escapeMdxInline(modelType)}\` |`);
  if (parameters) specLines.push(`| Parameters | ${escapeMdxInline(parameters)} |`);
  if (version) specLines.push(`| Version | ${escapeMdxInline(version)} |`);
  if (maxTokens) specLines.push(`| Max Tokens | ${escapeMdxInline(maxTokens)} |`);
  if (provider) specLines.push(`| Provider | ${escapeMdxInline(provider)} |`);
  if (inputPrice) specLines.push(`| Input Price | ${escapeMdxInline(inputPrice)} |`);
  if (outputPrice) specLines.push(`| Output Price | ${escapeMdxInline(outputPrice)} |`);
  if (totalPrice) specLines.push(`| Total Price | ${escapeMdxInline(totalPrice)} |`);

  const bodyParts = [];
  if (lead.length > 0) bodyParts.push(lead.join("\n\n"));
  if (bodyParts.length > 0) bodyParts.push("");
  bodyParts.push("## Specifications", "", specLines.join("\n"));

  const playground = playgroundsManifest?.[modelId];
  if (playground?.spec && playground?.primary) {
    bodyParts.push(
      "",
      "## Try it",
      "",
      `Send a live request with your \`x-api-key\` and \`x-project-id\`. Model is always \`${modelId}\` (in each request example). Use **request examples** below to switch use cases (JSON extraction, NER, PII, and so on).`,
      ""
    );
  } else {
    bodyParts.push(
      "",
      "## Quick Start",
      "",
      "See [API Reference](/api-reference/introduction) and the [model catalog](/platform/model-catalog) for request shapes."
    );
  }

  const body = bodyParts.join("\n");

  const frontmatter = [
    `title: "${title.replace(/"/g, '\\"')}"`,
    `description: "Model details for ${modelId.replace(/"/g, '\\"')}."`,
  ];
  if (playground?.spec && playground?.primary) {
    frontmatter.push(`openapi: "${playground.spec} ${playground.primary}"`);
  }

  return `---
${frontmatter.join("\n")}
---

${body}
`;
}

async function loadPlaygroundsManifest() {
  try {
    const raw = await readFile(playgroundsManifestPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function fetchModels() {
  try {
    const response = await fetch(MODELS_ENDPOINT, {
      headers: { accept: "application/json", "user-agent": "zerogpu-docs-generator" },
    });
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    const payload = await response.json();
    if (!payload || payload.success !== true || !Array.isArray(payload.models)) {
      throw new Error("Unexpected API response shape");
    }
    return payload.models;
  } catch (error) {
    const fallbackRaw = await readFile(fallbackPath, "utf8");
    const fallbackPayload = JSON.parse(fallbackRaw);
    if (
      !fallbackPayload ||
      fallbackPayload.success !== true ||
      !Array.isArray(fallbackPayload.models)
    ) {
      throw new Error(
        `Could not fetch API or parse fallback payload: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    return fallbackPayload.models;
  }
}

async function main() {
  await mkdir(modelsDir, { recursive: true });
  const [models, playgroundsManifest] = await Promise.all([
    fetchModels(),
    loadPlaygroundsManifest(),
  ]);
  const visibleModels = models.filter((model) => model && model.display !== false);

  let written = 0;
  for (const model of visibleModels) {
    const fileName = `${slugify(model.modelId)}.mdx`;
    const targetPath = path.join(modelsDir, fileName);
    const content = buildMdx(model, playgroundsManifest);
    await writeFile(targetPath, content, "utf8");
    written += 1;
  }

  process.stdout.write(`Generated ${written} model page(s) in docs/models.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
