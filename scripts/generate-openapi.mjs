#!/usr/bin/env node
/**
 * Regenerate openapi/zerogpu.openapi.yaml from the models API.
 * Adds model enum (dropdown) and per-model request examples for Mintlify playground.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const MODELS_ENDPOINT = "https://api-dashboard.zerogpu.ai/api/models";
const docsRoot = process.cwd();
const openapiPath = path.join(docsRoot, "openapi", "zerogpu.openapi.json");
const fallbackPath = path.join(docsRoot, "snippets", "model-catalog-fallback.json");

function exampleKey(modelId) {
  return String(modelId).replace(/[^a-zA-Z0-9_-]/g, "_");
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

function buildOpenApiDocument(models) {
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

  const responsesEnum = responsesEntries.map((e) => e.modelId).sort();
  const chatEnum = chatEntries.map((e) => e.modelId).sort();

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
        "In the API playground, pick a **model** from the dropdown, then choose a **request example** for that model.",
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
                examples: buildExamples(responsesEntries),
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
                examples: buildExamples(chatEntries),
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
    components: {
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
              description:
                "Model identifier from the [model catalog](https://docs.zerogpu.ai/platform/model-catalog).",
              enum: responsesEnum,
              example: responsesEnum[0] || "gliner2-base-v1",
            },
            input: {
              description:
                "Model-dependent input. Many models accept a plain string. Others accept a message list with role and content.",
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
            instructions: {
              type: "string",
              description: "Optional system-style instructions (some classification models).",
            },
            metadata: {
              type: "object",
              additionalProperties: true,
              description:
                "Optional model-specific parameters (e.g. usecase, schema, labels, mask).",
            },
          },
        },
        CreateChatCompletionRequest: {
          type: "object",
          required: ["model", "messages"],
          properties: {
            model: {
              type: "string",
              description:
                "Model identifier from the [model catalog](https://docs.zerogpu.ai/platform/model-catalog).",
              enum: chatEnum,
              example: chatEnum[0] || "gliner-multi-pii-v1",
            },
            messages: {
              type: "array",
              minItems: 1,
              items: { $ref: "#/components/schemas/ChatMessage" },
            },
            metadata: {
              type: "object",
              additionalProperties: true,
            },
          },
        },
        ChatMessage: {
          type: "object",
          required: ["role", "content"],
          properties: {
            role: {
              type: "string",
              enum: ["system", "user", "assistant"],
            },
            content: { type: "string" },
          },
        },
        ChatCompletionResponse: {
          type: "object",
          additionalProperties: true,
          properties: {
            id: { type: "string" },
            object: { type: "string" },
            created: { type: "integer", format: "int64" },
            model: { type: "string" },
            choices: {
              type: "array",
              items: { type: "object", additionalProperties: true },
            },
            usage: { $ref: "#/components/schemas/TokenUsage" },
          },
        },
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
              properties: {
                type: { type: "string", example: "text" },
              },
            },
          },
        },
        Response: {
          type: "object",
          required: ["id", "object", "created", "model", "output"],
          properties: {
            id: { type: "string", example: "resp_abc123" },
            object: { type: "string", example: "response" },
            created: { type: "integer", format: "int64" },
            model: { type: "string" },
            output: {
              type: "array",
              items: { $ref: "#/components/schemas/OutputMessage" },
            },
            usage: { $ref: "#/components/schemas/TokenUsage" },
          },
        },
        OutputMessage: {
          type: "object",
          properties: {
            type: { type: "string", example: "message" },
            role: { type: "string", example: "assistant" },
            content: {
              type: "array",
              items: { $ref: "#/components/schemas/OutputContentBlock" },
            },
          },
        },
        OutputContentBlock: {
          type: "object",
          properties: {
            type: { type: "string", example: "output_text" },
            text: { type: "string" },
          },
        },
        TokenUsage: {
          type: "object",
          properties: {
            input_tokens: { type: "integer" },
            output_tokens: { type: "integer" },
            total_tokens: { type: "integer" },
          },
        },
        ErrorResponse: {
          type: "object",
          additionalProperties: true,
        },
      },
    },
  };
}

async function main() {
  const models = await fetchModels();
  const doc = buildOpenApiDocument(models);
  const jsonText = JSON.stringify(doc, null, 2) + "\n";
  await writeFile(openapiPath, jsonText, "utf8");

  const visible = models.filter((m) => m && m.display !== false);
  const responsesCount = visible.filter((m) => pickResponsesBody(m)).length;
  const chatCount = visible.filter((m) => pickChatBody(m)).length;
  process.stdout.write(
    `Wrote ${openapiPath}\n` +
      `  ${responsesCount} Responses example(s), ${chatCount} Chat Completions example(s)\n`
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
