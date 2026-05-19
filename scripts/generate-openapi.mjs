#!/usr/bin/env node
/**
 * Regenerate OpenAPI + playground payloads from the models API.
 * Discriminated schemas tie the model dropdown to each model's request body.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const MODELS_ENDPOINT = "https://api-dashboard.zerogpu.ai/api/models";
const docsRoot = process.cwd();
const openapiPath = path.join(docsRoot, "openapi", "zerogpu.openapi.json");
const payloadsPath = path.join(docsRoot, "openapi", "zerogpu-playground-payloads.json");
const fallbackPath = path.join(docsRoot, "snippets", "model-catalog-fallback.json");

const USECASE_PREFERENCE = ["json", "extract-pii", "ner", "redact", "classification"];

function schemaName(prefix, modelId) {
  return `${prefix}_${String(modelId).replace(/[^a-zA-Z0-9]/g, "_")}`;
}

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

function inferPropertySchema(value) {
  if (value === null || value === undefined) {
    return { nullable: true };
  }
  if (Array.isArray(value)) {
    return {
      type: "array",
      items: value.length > 0 ? inferPropertySchema(value[0]) : {},
    };
  }
  if (typeof value === "object") {
    const properties = {};
    for (const [key, val] of Object.entries(value)) {
      properties[key] = inferPropertySchema(val);
    }
    return { type: "object", properties, additionalProperties: true };
  }
  if (typeof value === "number") {
    return { type: "number" };
  }
  if (typeof value === "boolean") {
    return { type: "boolean" };
  }
  return { type: "string" };
}

function buildModelBodySchema(name, modelId, body) {
  const properties = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === "model") {
      properties.model = {
        type: "string",
        const: modelId,
        description: "Model identifier",
      };
    } else {
      properties[key] = inferPropertySchema(value);
    }
  }
  return {
    [name]: {
      type: "object",
      required: Object.keys(body),
      properties,
      additionalProperties: false,
    },
  };
}

function buildDiscriminatedRequest(prefix, entries) {
  const schemas = {};
  const mapping = {};
  const oneOf = [];

  for (const entry of entries) {
    const name = schemaName(prefix, entry.modelId);
    Object.assign(schemas, buildModelBodySchema(name, entry.modelId, entry.body));
    mapping[entry.modelId] = `#/components/schemas/${name}`;
    oneOf.push({ $ref: `#/components/schemas/${name}` });
  }

  return {
    requestSchema: {
      oneOf,
      discriminator: {
        propertyName: "model",
        mapping,
      },
    },
    schemas,
  };
}

function buildPayloadMap(entries) {
  const map = {};
  for (const entry of entries) {
    map[entry.modelId] = entry.body;
  }
  return map;
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
        body: { ...picked.body, model: model.modelId },
      });
    }
    const chatPicked = pickChatBody(model);
    if (chatPicked) {
      chatEntries.push({
        modelId: model.modelId,
        body: { ...chatPicked.body, model: model.modelId },
      });
    }
  }

  const responsesDisc = buildDiscriminatedRequest("ResponsesBody", responsesEntries);
  const chatDisc = buildDiscriminatedRequest("ChatBody", chatEntries);

  const sharedSchemas = {
    ChatMessage: {
      type: "object",
      required: ["role", "content"],
      properties: {
        role: { type: "string", enum: ["system", "user", "assistant"] },
        content: { type: "string" },
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
        "In the API playground, change **model** to load that model's sample request body automatically.",
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
                example: responsesEntries[0]?.body,
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
                example: chatEntries[0]?.body,
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
        CreateResponseRequest: responsesDisc.requestSchema,
        CreateChatCompletionRequest: chatDisc.requestSchema,
        ...responsesDisc.schemas,
        ...chatDisc.schemas,
        ...sharedSchemas,
      },
    },
  };
}

async function main() {
  const models = await fetchModels();
  const visible = models.filter((m) => m && m.display !== false);

  const responsesEntries = [];
  const chatEntries = [];
  for (const model of visible) {
    const picked = pickResponsesBody(model);
    if (picked) {
      responsesEntries.push({
        modelId: model.modelId,
        body: { ...picked.body, model: model.modelId },
      });
    }
    const chatPicked = pickChatBody(model);
    if (chatPicked) {
      chatEntries.push({
        modelId: model.modelId,
        body: { ...chatPicked.body, model: model.modelId },
      });
    }
  }

  const doc = buildOpenApiDocument(models);
  await writeFile(openapiPath, JSON.stringify(doc, null, 2) + "\n", "utf8");

  const payloads = {
    responses: buildPayloadMap(responsesEntries),
    chat: buildPayloadMap(chatEntries),
  };
  await writeFile(payloadsPath, JSON.stringify(payloads, null, 2) + "\n", "utf8");

  process.stdout.write(
    `Wrote ${openapiPath}\n` +
      `Wrote ${payloadsPath}\n` +
      `  ${responsesEntries.length} Responses model(s), ${chatEntries.length} Chat model(s)\n`
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
