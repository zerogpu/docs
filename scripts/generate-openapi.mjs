#!/usr/bin/env node
/**
 * Regenerate OpenAPI specs from the models API.
 * - openapi/zerogpu.openapi.json — generic API reference (no all-model dropdown)
 * - openapi/playgrounds/{model}.openapi.json — one live playground per catalog model
 * - snippets/model-playgrounds.json — manifest for generate-model-pages.mjs
 */

import { mkdir, readFile, writeFile, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const MODELS_ENDPOINT = "https://api-dashboard.zerogpu.ai/api/models";
const docsRoot = process.cwd();
const openapiPath = path.join(docsRoot, "openapi", "zerogpu.openapi.json");
const playgroundsDir = path.join(docsRoot, "openapi", "playgrounds");
const manifestPath = path.join(docsRoot, "snippets", "model-playgrounds.json");
const modelsIndexPath = path.join(docsRoot, "api-reference", "models", "index.mdx");
const docsJsonPath = path.join(docsRoot, "docs.json");
const fallbackPath = path.join(docsRoot, "snippets", "model-catalog-fallback.json");

const MODEL_PLAYGROUNDS_PATH = "/api-reference/models";
const MODEL_FIELD_DESCRIPTION =
  "Model identifier. Open a [model page](" +
  MODEL_PLAYGROUNDS_PATH +
  ") for a dedicated playground with the correct body for that model.";

function exampleKey(modelId) {
  return String(modelId).replace(/[^a-zA-Z0-9_-]/g, "_");
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function playgroundFileName(modelId) {
  return `${exampleKey(modelId)}.openapi.json`;
}

const USECASE_PREFERENCE = ["json", "extract-pii", "ner", "redact", "classification"];

function pickFromUsecases(usecases, field) {
  if (!usecases || typeof usecases !== "object") return null;
  for (const key of USECASE_PREFERENCE) {
    const value = usecases[key];
    if (value && value[field]) {
      return { body: value[field], label: value.usecase_display_name || key };
    }
  }
  for (const value of Object.values(usecases)) {
    if (value && value[field]) {
      return { body: value[field], label: value.usecase_display_name };
    }
  }
  return null;
}

function pickResponsesBody(model) {
  const pricing = model.pricing || {};
  const fromUsecases = pickFromUsecases(model.modelUsecases, "sample_responses_body");
  if (fromUsecases) return fromUsecases;
  if (pricing.sample_responses_body) {
    return { body: pricing.sample_responses_body, label: null };
  }
  return null;
}

function pickChatBody(model) {
  const pricing = model.pricing || {};
  const fromUsecases = pickFromUsecases(model.modelUsecases, "sample_chat_completions_body");
  if (fromUsecases) return fromUsecases;
  if (pricing.sample_chat_completions_body) {
    return { body: pricing.sample_chat_completions_body, label: null };
  }
  return null;
}

/** Omit optional response-format boilerplate from playground bodies. */
function stripPlaygroundRequestBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const { text: _text, ...rest } = body;
  return rest;
}

function collectRouteExamples(model, field, fallbackBody) {
  const examples = {};
  const usecases = model.modelUsecases || {};
  for (const [key, value] of Object.entries(usecases)) {
    if (!value || typeof value !== "object" || !value[field]) continue;
    examples[exampleKey(key)] = {
      summary: value.usecase_display_name || key,
      value: stripPlaygroundRequestBody(value[field]),
    };
  }
  if (Object.keys(examples).length === 0 && fallbackBody) {
    examples.default = { summary: "Default", value: stripPlaygroundRequestBody(fallbackBody) };
  }
  return examples;
}

function inputTypesInExamples(examples) {
  const types = new Set();
  for (const ex of Object.values(examples)) {
    const input = ex?.value?.input;
    if (typeof input === "string") types.add("string");
    if (Array.isArray(input)) types.add("array");
  }
  return types;
}

/** Mintlify renders `format: textarea` as a multi-line field (not a one-line input). */
function buildResponsesInputSchema(examples) {
  const types = inputTypesInExamples(examples);
  if (types.size === 1 && types.has("string")) {
    return {
      type: "string",
      minLength: 1,
      format: "textarea",
      maxLength: 131072,
      description: "Multi-line text or document content to send to the model.",
    };
  }
  if (types.size === 1 && types.has("array")) {
    return {
      type: "array",
      minItems: 1,
      description: "Message list with role and content.",
      items: { $ref: "#/components/schemas/InputMessage" },
    };
  }
  return {
    description:
      "Model-dependent input. Plain string or message list with role and content.",
    oneOf: [
      { type: "string", minLength: 1, format: "textarea" },
      {
        type: "array",
        minItems: 1,
        items: { $ref: "#/components/schemas/InputMessage" },
      },
    ],
  };
}

const textareaString = {
  type: "string",
  minLength: 1,
  format: "textarea",
  maxLength: 131072,
  description: "Multi-line text. Use a tall text area in the playground (not a single-line input).",
};

function buildExamples(entries) {
  const examples = {};
  for (const entry of entries) {
    const key = exampleKey(entry.modelId);
    const task = entry.taskDisplayName || entry.taskType || "Model";
    const suffix = entry.usecaseLabel ? ` (${entry.usecaseLabel})` : "";
    examples[key] = {
      summary: `${entry.modelDisplayName || entry.modelId} · ${task}${suffix}`,
      value: stripPlaygroundRequestBody(entry.body),
    };
  }
  return examples;
}

async function fetchModels() {
  try {
    const response = await fetch(MODELS_ENDPOINT, {
      headers: { accept: "application/json", "user-agent": "zerogpu-docs-openapi-generator" },
    });
    if (!response.ok) throw new Error(`API ${response.status}`);
    const payload = await response.json();
    if (!payload?.success || !Array.isArray(payload.models)) {
      throw new Error("Unexpected API shape");
    }
    return payload.models;
  } catch (error) {
    const raw = await readFile(fallbackPath, "utf8");
    const payload = JSON.parse(raw);
    if (!payload?.success || !Array.isArray(payload.models)) {
      throw new Error(`API and fallback failed: ${error.message}`);
    }
    return payload.models;
  }
}

function sharedComponents() {
  return {
    securitySchemes: {
      ApiKey: {
        type: "apiKey",
        in: "header",
        name: "x-api-key",
      },
      ProjectId: {
        type: "apiKey",
        in: "header",
        name: "x-project-id",
      },
    },
    schemas: {
      CreateResponseRequest: {
        type: "object",
        required: ["model", "input"],
        properties: {
          model: {
            type: "string",
            description: "Model identifier (fixed for this playground).",
          },
          input: {
            description:
              "Model-dependent input. Plain string or message list with role and content.",
            oneOf: [
              { ...textareaString, description: "Plain text or document body." },
              {
                type: "array",
                minItems: 1,
                items: { $ref: "#/components/schemas/InputMessage" },
              },
            ],
          },
          instructions: { type: "string" },
          metadata: { type: "object", additionalProperties: true },
        },
      },
      CreateChatCompletionRequest: {
        type: "object",
        required: ["model", "messages"],
        properties: {
          model: { type: "string" },
          messages: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/components/schemas/ChatMessage" },
          },
          metadata: { type: "object", additionalProperties: true },
        },
      },
      ChatMessage: {
        type: "object",
        required: ["role", "content"],
        properties: {
          role: { type: "string", enum: ["system", "user", "assistant"] },
          content: { ...textareaString, description: "Message text." },
        },
      },
      ChatCompletionResponse: { type: "object", additionalProperties: true },
      InputMessage: {
        type: "object",
        required: ["role", "content"],
        properties: {
          role: { type: "string", enum: ["user", "system"] },
          content: { ...textareaString, description: "Message text." },
        },
      },
      Response: { type: "object", additionalProperties: true },
      ErrorResponse: { type: "object", additionalProperties: true },
    },
  };
}

function fixedModelProperty(modelId, description) {
  return {
    type: "string",
    const: modelId,
    default: modelId,
    example: modelId,
    readOnly: true,
    description:
      description ||
      "Model identifier (fixed for this playground). Use request examples to change use cases.",
  };
}

function requestBodySchemaWithFixedModel(baseRef, modelId, description) {
  return {
    allOf: [
      { $ref: baseRef },
      {
        type: "object",
        properties: { model: fixedModelProperty(modelId, description) },
      },
    ],
  };
}

const PLAYGROUND_MODEL_DESCRIPTION =
  "Model identifier (fixed for this playground). Use request examples to change use cases.";

function buildModelPlaygroundOpenApi(model) {
  const modelId = model.modelId;
  const displayName = model.modelDisplayName || modelId;
  const pricing = model.pricing || {};
  const paths = {};
  const operations = [];

  const responsesExamples = collectRouteExamples(
    model,
    "sample_responses_body",
    pricing.sample_responses_body
  );
  if (Object.keys(responsesExamples).length > 0) {
    paths["/responses"] = {
      post: {
        operationId: `createResponse_${exampleKey(modelId)}`,
        summary: `${displayName} — Responses`,
        tags: [displayName],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: requestBodySchemaWithFixedModel(
                "#/components/schemas/CreateResponseRequest",
                modelId,
                PLAYGROUND_MODEL_DESCRIPTION
              ),
              examples: responsesExamples,
            },
          },
        },
        responses: {
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Response" },
              },
            },
          },
          "400": { description: "Bad request" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
          "420": {
            description: "Context length exceeded",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "500": { description: "Internal server error" },
        },
      },
    };
    operations.push("POST /responses");
  }

  const chatExamples = collectRouteExamples(
    model,
    "sample_chat_completions_body",
    pricing.sample_chat_completions_body
  );
  if (Object.keys(chatExamples).length > 0) {
    paths["/chat/completions"] = {
      post: {
        operationId: `createChatCompletion_${exampleKey(modelId)}`,
        summary: `${displayName} — Chat completions`,
        tags: [displayName],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: requestBodySchemaWithFixedModel(
                "#/components/schemas/CreateChatCompletionRequest",
                modelId,
                PLAYGROUND_MODEL_DESCRIPTION
              ),
              examples: chatExamples,
            },
          },
        },
        responses: {
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ChatCompletionResponse" },
              },
            },
          },
          "400": { description: "Bad request" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
          "420": { description: "Context length exceeded" },
          "500": { description: "Internal server error" },
        },
      },
    };
    operations.push("POST /chat/completions");
  }

  if (operations.length === 0) return null;

  const components = sharedComponents();
  const fixedModel = fixedModelProperty(modelId, PLAYGROUND_MODEL_DESCRIPTION);
  if (Object.keys(responsesExamples).length > 0) {
    components.schemas.CreateResponseRequest.properties.model = fixedModel;
    components.schemas.CreateResponseRequest.properties.input =
      buildResponsesInputSchema(responsesExamples);
  }
  if (Object.keys(chatExamples).length > 0) {
    components.schemas.CreateChatCompletionRequest.properties.model = fixedModel;
  }

  return {
    openapi: "3.1.0",
    info: {
      title: `${displayName} playground`,
      version: "1.0",
      description: [
        `Interactive playground for **${modelId}**.`,
        `Model is always \`${modelId}\` on this page (shown in the form, not editable).`,
        "Use the **request example** selector to switch use cases (JSON, NER, PII, etc.).",
        "Authentication: `x-api-key` and `x-project-id`.",
      ].join("\n"),
    },
    servers: [{ url: "https://api.zerogpu.ai/v1", description: "Production" }],
    security: [{ ApiKey: [], ProjectId: [] }],
    paths,
    components,
    "x-zgpu-operations": operations,
  };
}

function buildMainOpenApiDocument(models) {
  const visible = models.filter((m) => m && m.display !== false);

  const responsesEntries = [];
  const chatEntries = [];

  for (const model of visible) {
    const picked = pickResponsesBody(model);
    if (picked) {
      responsesEntries.push({
        modelId: model.modelId,
        modelDisplayName: model.modelDisplayName,
        taskDisplayName: model.taskDisplayName,
        taskType: model.taskType,
        usecaseLabel: picked.label,
        body: picked.body,
      });
    }
    const chatPicked = pickChatBody(model);
    if (chatPicked) {
      chatEntries.push({
        modelId: model.modelId,
        modelDisplayName: model.modelDisplayName,
        taskDisplayName: model.taskDisplayName,
        taskType: model.taskType,
        usecaseLabel: chatPicked.label,
        body: chatPicked.body,
      });
    }
  }

  const firstResponses = responsesEntries[0];
  const firstChat = chatEntries[0];

  const responsesExamples = firstResponses
    ? {
        default: {
          summary: `${firstResponses.modelDisplayName || firstResponses.modelId} (see model pages for more)`,
          value: stripPlaygroundRequestBody(firstResponses.body),
        },
      }
    : undefined;

  const chatExamples = firstChat
    ? {
        default: {
          summary: `${firstChat.modelDisplayName || firstChat.modelId} (see model pages for more)`,
          value: firstChat.body,
        },
      }
    : undefined;

  const defaultResponsesModelId = firstResponses?.modelId || "gliner2-base-v1";
  const components = sharedComponents();
  components.schemas.CreateResponseRequest.properties.model = fixedModelProperty(
    defaultResponsesModelId,
    MODEL_FIELD_DESCRIPTION
  );
  components.schemas.CreateChatCompletionRequest.properties.model = {
    type: "string",
    description: MODEL_FIELD_DESCRIPTION,
    example: firstChat?.modelId || "gliner-multi-pii-v1",
  };

  return {
    openapi: "3.1.0",
    info: {
      title: "ZeroGPU API",
      version: "1.0",
      description: [
        "REST API for ZeroGPU model inference: `POST /v1/responses` and `POST /v1/chat/completions` (model-dependent).",
        "Authentication uses `x-api-key` and `x-project-id` headers on every request.",
        "Documentation: https://docs.zerogpu.ai",
        "",
        `**Per-model playgrounds** are listed on [Model playgrounds](${MODEL_PLAYGROUNDS_PATH}) with request examples for each model's use cases.`,
        "These endpoint pages show a generic shape only.",
      ].join("\n"),
    },
    servers: [{ url: "https://api.zerogpu.ai/v1", description: "Production" }],
    security: [{ ApiKey: [], ProjectId: [] }],
    paths: {
      "/responses": {
        post: {
          operationId: "createResponse",
          summary: "Send input to a model and receive a response",
          tags: ["Responses"],
          "x-mint": {
            metadata: {
              title: "Responses",
              description: "Send input to an AI model and receive a response.",
            },
          },
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: requestBodySchemaWithFixedModel(
                  "#/components/schemas/CreateResponseRequest",
                  defaultResponsesModelId,
                  MODEL_FIELD_DESCRIPTION
                ),
                ...(responsesExamples ? { examples: responsesExamples } : {}),
              },
            },
          },
          responses: {
            "200": {
              description: "Success",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Response" },
                },
              },
            },
            "400": { description: "Bad request (invalid body)" },
            "401": { description: "Unauthorized (invalid or missing API key)" },
            "403": { description: "Forbidden (invalid project ID or permissions)" },
            "420": {
              description: "Input exceeds model token limit (context_length_exceeded)",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "500": { description: "Internal server error" },
          },
        },
      },
      "/chat/completions": {
        post: {
          operationId: "createChatCompletion",
          summary: "Chat-completions style inference",
          description:
            "OpenAI-compatible chat body for models that use the messages route.",
          tags: ["Chat"],
          "x-mint": {
            metadata: {
              title: "Chat completions",
              sidebarTitle: "Chat completions",
              description: "Chat-style inference for models that use the messages route.",
            },
          },
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateChatCompletionRequest" },
                ...(chatExamples ? { examples: chatExamples } : {}),
              },
            },
          },
          responses: {
            "200": {
              description: "Success",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ChatCompletionResponse" },
                },
              },
            },
            "400": { description: "Bad request (invalid body)" },
            "401": { description: "Unauthorized (invalid or missing API key)" },
            "403": { description: "Forbidden (invalid project ID or permissions)" },
            "420": {
              description: "Input exceeds model token limit (context_length_exceeded)",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "500": { description: "Internal server error" },
          },
        },
      },
    },
    components,
  };
}

async function writeModelPlaygrounds(models) {
  await mkdir(playgroundsDir, { recursive: true });

  const existing = await readdir(playgroundsDir).catch(() => []);
  for (const file of existing) {
    if (file.endsWith(".openapi.json")) {
      await unlink(path.join(playgroundsDir, file));
    }
  }

  const manifest = {};
  const visible = models.filter((m) => m && m.display !== false);

  for (const model of visible) {
    const doc = buildModelPlaygroundOpenApi(model);
    if (!doc) continue;

    const fileName = playgroundFileName(model.modelId);
    const relPath = `openapi/playgrounds/${fileName}`;
    const operations = doc["x-zgpu-operations"];
    delete doc["x-zgpu-operations"];

    await writeFile(path.join(playgroundsDir, fileName), JSON.stringify(doc, null, 2) + "\n", "utf8");

    manifest[model.modelId] = {
      spec: relPath,
      operations,
      primary: operations[0],
      page: `models/${slugify(model.modelId)}`,
      displayName: model.modelDisplayName || model.modelId,
    };
  }

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  return manifest;
}

async function writeModelsIndexPage(manifest) {
  await mkdir(path.dirname(modelsIndexPath), { recursive: true });

  const entries = Object.entries(manifest).sort(([, a], [, b]) =>
    (a.displayName || "").localeCompare(b.displayName || "", undefined, { sensitivity: "base" })
  );

  const cards = entries
    .map(
      ([modelId, entry]) =>
        `  <Card title="${String(entry.displayName).replace(/"/g, '\\"')}" href="/${entry.page}">\n    Live playground for \`${modelId}\` with use-case request examples.\n  </Card>`
    )
    .join("\n");

  const mdx = `---
title: "Model playgrounds"
description: "Interactive API playgrounds per catalog model, under API Reference."
---

Each model has its own playground with a fixed model ID and **request examples** for that model's use cases (JSON extraction, NER, classification, and so on). Open a model below or from the [model catalog](/platform/model-catalog). For the full list under API Reference, see [Model playgrounds](/api-reference/models).

<CardGroup cols={2}>
${cards}
</CardGroup>

For generic \`POST /v1/responses\` and \`POST /v1/chat/completions\` shapes, see [Responses](/api-reference/endpoint/responses) and [Chat completions](/api-reference/endpoint/chat-completions).
`;

  await writeFile(modelsIndexPath, mdx, "utf8");
}

async function updateApiReferenceNav(manifest) {
  const docs = JSON.parse(await readFile(docsJsonPath, "utf8"));
  const apiTab = docs.navigation?.tabs?.find((tab) => tab.tab === "API Reference");
  if (!apiTab) throw new Error("API Reference tab not found in docs.json");

  const endpointsGroup = apiTab.groups?.find((group) => group.group === "Endpoints");
  if (!endpointsGroup) throw new Error("Endpoints group not found in docs.json");

  const modelPages = Object.values(manifest)
    .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || "", undefined, { sensitivity: "base" }))
    .map((entry) => entry.page);

  endpointsGroup.pages = [
    "api-reference/endpoint/responses",
    "api-reference/endpoint/chat-completions",
    {
      group: "By model",
      pages: ["api-reference/models/index", ...modelPages],
    },
  ];

  await writeFile(docsJsonPath, JSON.stringify(docs, null, 2) + "\n", "utf8");
}

async function main() {
  const models = await fetchModels();
  const mainDoc = buildMainOpenApiDocument(models);
  await writeFile(openapiPath, JSON.stringify(mainDoc, null, 2) + "\n", "utf8");

  const manifest = await writeModelPlaygrounds(models);
  await writeModelsIndexPage(manifest);
  await updateApiReferenceNav(manifest);

  process.stdout.write(
    `Wrote ${openapiPath}\n` +
      `Wrote ${Object.keys(manifest).length} model playground spec(s) in openapi/playgrounds/\n` +
      `Wrote ${manifestPath}\n` +
      `Wrote ${modelsIndexPath}\n` +
      `Updated API Reference → Endpoints → By model in docs.json\n`
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
