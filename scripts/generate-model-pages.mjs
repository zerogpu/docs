#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const MODELS_ENDPOINT = "https://api-dashboard.zerogpu.ai/api/models";
const projectRoot = process.cwd();
const docsRoot = path.join(projectRoot);
const modelsDir = path.join(docsRoot, "models");
const fallbackPath = path.join(docsRoot, "snippets", "model-catalog-fallback.json");

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function textOrNA(value) {
  if (value === null || value === undefined || value === "") return "N/A";
  return String(value);
}

function fmtMoney(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return `$${value.toFixed(2)} / 1M`;
}

function escapeMdxInline(value) {
  return textOrNA(value).replace(/\|/g, "\\|");
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

function renderRequestSection(title, endpointPath, payload, includeLanguageSnippets = false) {
  let out = `### ${title}\n\n`;
  out += "#### Request Body (JSON)\n\n";
  out += "```json\n" + toPrettyJson(payload) + "\n```\n\n";
  out += "#### Code Snippet (cURL)\n\n";
  out += "```bash\n" + renderCurlSnippet(endpointPath, payload) + "\n```\n\n";

  if (includeLanguageSnippets) {
    out += "#### Code Snippet (Python)\n\n";
    out += "```python\n" + renderPythonSnippet(endpointPath, payload) + "\n```\n\n";
    out += "#### Code Snippet (JavaScript)\n\n";
    out += "```javascript\n" + renderJavaScriptSnippet(endpointPath, payload) + "\n```\n\n";
    out += "#### Code Snippet (Rust)\n\n";
    out += "```rust\n" + renderRustSnippet(endpointPath, payload) + "\n```\n\n";
    out += "#### Code Snippet (Go)\n\n";
    out += "```go\n" + renderGoSnippet(endpointPath, payload) + "\n```\n\n";
    out += "#### Code Snippet (Ruby)\n\n";
    out += "```ruby\n" + renderRubySnippet(endpointPath, payload) + "\n```\n\n";
  }

  return out;
}

function renderModelUsecaseSections(model) {
  if (!model.modelUsecases || typeof model.modelUsecases !== "object") return "";
  const entries = Object.entries(model.modelUsecases).filter(
    ([, value]) => value && typeof value === "object"
  );
  if (entries.length === 0) return "";

  let out = "## Use Case Examples\n\n";
  out += "Select Use Case examples below:\n\n";

  for (const [, value] of entries) {
    const label = textOrNA(value.usecase_display_name || value.usecase || "Use Case");
    const description = textOrNA(value.description || "");
    const sample =
      (value.sample_responses_body && typeof value.sample_responses_body === "object"
        ? value.sample_responses_body
        : null) || null;
    if (!sample) continue;

    const normalized = { ...sample, model: textOrNA(model.modelId) };
    out += `### ${label}\n\n`;
    if (description && description !== "N/A") {
      out += description + "\n\n";
    }
    out += "#### Request Body (JSON)\n\n";
    out += "```json\n" + toPrettyJson(normalized) + "\n```\n\n";
    out += "#### Code Snippet (cURL)\n\n";
    out += "```bash\n" + renderCurlSnippet("/v1/responses", normalized) + "\n```\n\n";
  }

  return out;
}

function buildMdx(model) {
  const pricing = model.pricing || {};
  const modelId = textOrNA(model.modelId);
  const title = textOrNA(model.modelDisplayName || modelId);
  const description = textOrNA(pricing.description);
  const task = textOrNA(model.taskDisplayName || model.taskType);
  const modelType = textOrNA(model.modelType);
  const parameters = textOrNA(model.parameters);
  const version = textOrNA(model.modelVersion);
  const maxTokens = textOrNA(model.maxTokens);
  const provider = textOrNA(model.cloudProvider || "N/A");
  const inputPrice = fmtMoney(pricing.input_per_1m_tokens);
  const outputPrice = fmtMoney(pricing.output_per_1m_tokens);
  const sampleFromUseCases =
    model.modelUsecases && typeof model.modelUsecases === "object"
      ? Object.values(model.modelUsecases)
          .map((entry) => entry && entry.sample_responses_body)
          .find(Boolean)
      : null;
  const defaultSample = {
    text: { format: { type: "text" } },
    input: [{ role: "user", content: "Your input text here..." }],
    model: modelId,
  };
  const sampleRequestBody =
    pricing.sample_responses_body || sampleFromUseCases || defaultSample;
  const sampleChatBody = pricing.sample_chat_completions_body || {
    model: modelId,
    messages: (sampleRequestBody && sampleRequestBody.input) || defaultSample.input,
  };
  const normalizedSampleBody =
    sampleRequestBody && typeof sampleRequestBody === "object"
      ? { ...sampleRequestBody, model: modelId }
      : defaultSample;
  const normalizedChatBody =
    sampleChatBody && typeof sampleChatBody === "object"
      ? { ...sampleChatBody, model: modelId }
      : { model: modelId, messages: defaultSample.input };

  const references = [];
  if (pricing.model_doc_url) references.push(`[Model docs](${pricing.model_doc_url})`);
  if (pricing.terms_url) references.push(`[Terms](${pricing.terms_url})`);
  if (pricing.privacy_service) references.push(`[Privacy](${pricing.privacy_service})`);
  const referencesLine = references.length > 0 ? references.join(" • ") : "N/A";

  return `---
title: "${title.replace(/"/g, '\\"')}"
description: "Model details for ${modelId.replace(/"/g, '\\"')}."
---

> ${escapeMdxInline(description)}

**References:** ${referencesLine}

## Specifications

| Property | Value |
| --- | --- |
| Model ID | \`${escapeMdxInline(modelId)}\` |
| Task | ${escapeMdxInline(task)} |
| Type | \`${escapeMdxInline(modelType)}\` |
| Parameters | ${escapeMdxInline(parameters)} |
| Version | ${escapeMdxInline(version)} |
| Max Tokens | ${escapeMdxInline(maxTokens)} |
| Provider | ${escapeMdxInline(provider)} |
| Input Price | ${escapeMdxInline(inputPrice)} |
| Output Price | ${escapeMdxInline(outputPrice)} |

## Quick Start

${renderRequestSection("Responses API", "/v1/responses", normalizedSampleBody, false)}
${renderRequestSection("Chat Completions API", "/v1/chat/completions", normalizedChatBody, true)}
${renderModelUsecaseSections(model)}
`;
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
  const models = await fetchModels();
  const visibleModels = models.filter((model) => model && model.display !== false);

  let written = 0;
  for (const model of visibleModels) {
    const fileName = `${slugify(model.modelId)}.mdx`;
    const targetPath = path.join(modelsDir, fileName);
    const content = buildMdx(model);
    await writeFile(targetPath, content, "utf8");
    written += 1;
  }

  process.stdout.write(`Generated ${written} model page(s) in docs/models.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
