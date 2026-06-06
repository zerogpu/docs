## Example integration page

This is what `integrations/langchain.mdx` would look like. Use it as a template, swap the name, slug, icon, language, and Usage subsections for the integration you're documenting. The opening two paragraphs, Overview, Video walkthrough, Quickstart subheadings, Troubleshooting, and Conclusion structure stay the same on every page.

````mdx
---
title: "LangChain"
description: "Use ZeroGPU's nano language models as a drop-in LLM provider in LangChain pipelines."
---

LangChain is an open-source framework for building applications powered by large language models. It provides composable building blocks for prompts, chains, agents, retrieval, and tool use, with first-class support for OpenAI-compatible providers. Teams use LangChain to wire LLMs into production pipelines without rewriting glue code for every model vendor.

ZeroGPU is an ultra-fast, compute-efficient inference provider for apps and agents. We run purpose-built small and nano language models across an edge-powered network for the high-volume, purpose-specific tasks your app or agent runs constantly. Plug in our OpenAI-compatible API and you're live - zero GPU infrastructure, serverless, auto-scaling by default.

## Overview

This guide walks through using ZeroGPU as the LLM backend for a LangChain application. You'll install the LangChain OpenAI provider, point it at ZeroGPU's OpenAI-compatible endpoint, run your first chat completion, and then layer in streaming, structured output, and multi-model routing patterns. By the end you'll have a production-ready setup you can drop into any existing LangChain chain or agent.

## Video walkthrough

Video walkthrough coming soon.

## Quickstart

### Prerequisites

- A ZeroGPU [API key](https://platform.zerogpu.ai/dashboard).
- A model ID from the [model catalog](/docs/model-catalog) (for example, `lfm2-5-1-2b-instruct`).
- Python 3.9+.

### Get your ZeroGPU API key

1. Sign in to the [ZeroGPU dashboard](https://platform.zerogpu.ai/dashboard).
2. Open **API Keys** and click **Create key**.
3. Copy the key and export it locally.

```bash
export ZEROGPU_API_KEY="zg_..."
```

### Install LangChain

```bash
pip install langchain-openai
```

### Your first request

```python
import os
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="lfm2-5-1-2b-instruct",
    api_key=os.environ["ZEROGPU_API_KEY"],
    base_url="https://api.zerogpu.ai/v1",
)

response = llm.invoke("Summarize the benefits of nano language models in one sentence.")
print(response.content)
```

## Usage

### Chat completions

`ChatOpenAI` works with any ZeroGPU chat model. Swap the `model` argument to switch between `lfm2-5-1-2b-instruct`, `lfm2-5-1-2b-thinking`, and `llama-3-1-8b-instruct-fast`.

### Streaming

```python
for chunk in llm.stream("Write a haiku about serverless GPUs."):
    print(chunk.content, end="", flush=True)
```

### Structured output

Pair LangChain's `with_structured_output` with ZeroGPU's extraction models for schema-constrained responses.

### Multi-model routing in a chain

Use a cheap classifier (e.g. `deberta-v3-small`) as a router in front of a chat model so most traffic never hits the more expensive model.

## Troubleshooting

**`401 Unauthorized`**. `ZEROGPU_API_KEY` is missing or expired. Re-export it or rotate the key in the dashboard.

**`404 Not Found` on the model**, the `model` argument must match a slug from the [model catalog](/docs/model-catalog) exactly. Common typos include `lfm-2.5` instead of `lfm2-5-1-2b-instruct`.

**Empty streaming responses**, confirm `base_url` is `https://api.zerogpu.ai/v1` (with `/v1`); LangChain silently falls back to OpenAI defaults if the URL is wrong.

**Rate-limit errors under load**, switch to the [Batch API](/api-reference/batch/index) for offline jobs, or contact support to lift your tier.

## Conclusion

LangChain plus ZeroGPU gives you a familiar chain-and-agent abstraction backed by fast, low-cost nano models, so you can prototype and ship production AI pipelines without managing GPU infrastructure or rewriting glue code when you swap models.

<CardGroup cols={2}>
  <Card title="Model Catalog" icon="layer-group" href="/docs/model-catalog">
    Browse every model available on ZeroGPU and pick the best fit.
  </Card>
  <Card title="API Reference" icon="code" href="/api-reference/introduction">
    Explore the full OpenAI-compatible API surface.
  </Card>
  <Card title="Cookbook" icon="book" href="/cookbook/index">
    Worked examples for classification, extraction, and batch jobs.
  </Card>
  <Card title="Join Discord" icon="discord" href="https://discord.gg/Ad5KZvAyky">
    Ask questions and share what you're building.
  </Card>
</CardGroup>
````

## Index card to add

In `integrations/index.mdx`, inside the appropriate live `<CardGroup>` (e.g. "Editor & Agent Integrations"), add:

```mdx
<Card
    title="LangChain"
    icon="crow"
    href="/integrations/langchain"
>
    Drop ZeroGPU's nano language models into LangChain pipelines as an OpenAI-compatible provider.
</Card>
```

If the integration was in the "Coming Soon" grid, remove the placeholder card there.

## docs.json entry

In the Integrations tab's group `pages` array, alphabetical by slug after `integrations/index`:

```json
"pages": [
  "integrations/index",
  "integrations/claude-code-plugin",
  "integrations/langchain"
]
```
