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
const fallbackPath = path.join(docsRoot, "snippets", "model-catalog-fallback.json");

function exampleKey(modelId) {
  return String(modelId).replace(/[^a-zA-Z0-9_-]/g, "_");
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

function collectRouteExamples(model, field, fallbackBody) {
  const examples = {};
  const usecases = model.modelUsecases || {};
  for (const [key, value] of Object.entries(usecases)) {
    if (!value || typeof value !== "object" || !value[field]) continue;
    examples[exampleKey(key)] = {
      summary: value.usecase_display_name || key,
      value: value[field],
    };
  }
  if (Object.keys(examples).length === 0 && fallbackBody) {
    examples.default = { summary: "Default", value: fallbackBody };
  }
  return examples;
}

function buildExamples(entries) {
  const examples = {};
  for (const entry of entries) {
    const key = exampleKey(entry.modelId);
    const task = entry.taskDisplayName || entry.taskType || "Model";
    const suffix = entry.usecaseLabel ? ` (${entry.usecaseLabel})` : "";
    examples[key] = {
      summary: `${entry.modelDisplayName || entry.modelId} · ${task}${suffix}`,
      value: entry.body,
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
        description: "ZeroGPU API key from the dashboard (starts with zgpu-)",
      },
      ProjectId: {
        type: "apiKey",
        in: "header",
        name: "x-project-id",
        description: "Project UUID from the dashboard",
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
              { type: "string", minLength: 1 },
              {
                type: "array",
                minItems: 1,
                items: { $ref: "#/components/schemas/InputMessage" },
              },
            ],
          },
          text: { $ref: "#/components/schemas/TextResponseConfig" },
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
          content: { type: "string" },
        },
      },
      ChatCompletionResponse: { type: "object", additionalProperties: true },
      InputMessage: {
        type: "object",
        required: ["role", "content"],
        properties: {
          role: { type: "string", enum: ["user", "system"] },
          content: { type: "string" },
        },
      },
      TextResponseConfig: {
        type: "object",
        properties: {
          format: {
            type: "object",
            properties: { type: { type: "string", example: "text" } },
          },
        },
      },
      Response: { type: "object", additionalProperties: true },
      ErrorResponse: { type: "object", additionalProperties: true },
    },
  };
}

function fixedModelProperty(modelId) {
  return {
    type: "string",
    enum: [modelId],
    default: modelId,
    example: modelId,
  };
}

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
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/CreateResponseRequest" },
                  {
                    type: "object",
                    properties: { model: fixedModelProperty(modelId) },
                  },
                ],
              },
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
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/CreateChatCompletionRequest" },
                  {
                    type: "object",
                    properties: { model: fixedModelProperty(modelId) },
                  },
                ],
              },
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

  return {
    openapi: "3.1.0",
    info: {
      title: `${displayName} playground`,
      version: "1.0",
      description: [
        `Interactive playground for **${modelId}**.`,
        "Use the **request example** selector to switch use cases (JSON, NER, PII, etc.).",
        "Authentication: `x-api-key` and `x-project-id`.",
      ].join("\n"),
    },
    servers: [{ url: "https://api.zerogpu.ai/v1", description: "Production" }],
    security: [{ ApiKey: [], ProjectId: [] }],
    paths,
    components: sharedComponents(),
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
          value: firstResponses.body,
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

  const components = sharedComponents();
  components.schemas.CreateResponseRequest.properties.model = {
    type: "string",
    description:
      "Model identifier. Open a [model page](/platform/model-catalog) for a dedicated playground with the correct body for that model.",
    example: firstResponses?.modelId || "gliner2-base-v1",
  };
  components.schemas.CreateChatCompletionRequest.properties.model = {
    type: "string",
    description:
      "Model identifier. Open a [model page](/platform/model-catalog) for a dedicated playground.",
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
        "**Per-model playgrounds** live on each [model catalog](/platform/model-catalog) page with request examples for that model's use cases.",
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
                schema: { $ref: "#/components/schemas/CreateResponseRequest" },
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
    };
  }

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  return Object.keys(manifest).length;
}

async function main() {
  const models = await fetchModels();
  const mainDoc = buildMainOpenApiDocument(models);
  await writeFile(openapiPath, JSON.stringify(mainDoc, null, 2) + "\n", "utf8");

  const playgroundCount = await writeModelPlaygrounds(models);

  process.stdout.write(
    `Wrote ${openapiPath}\n` +
      `Wrote ${playgroundCount} model playground spec(s) in openapi/playgrounds/\n` +
      `Wrote ${manifestPath}\n`
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
