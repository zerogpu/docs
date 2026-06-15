---
name: integration-doc
description: Add or document a third-party integration in the ZeroGPU docs (integrations/ pages, docs.json nav, and the index card grids). Use this skill whenever the user asks to "add an integration", "document an integration for X", "create an integration page", "move X out of Coming Soon", or otherwise wires a new platform/SDK/framework into the /integrations/ tab. Encodes the repo's required page structure so the new page, the index card, and the nav entry all stay in sync.
---

# integration-doc

Add a new third-party integration page to the ZeroGPU docs and wire it into the navigation and the integrations index. Always update the page, the index card grid, and `docs.json` together.

## When to use

The user mentions adding, documenting, or promoting an integration: a new SDK, framework, agent runtime, automation platform, MCP client, IDE plugin, etc. Also use when moving an entry out of the "Coming Soon" grid into a live section because a real page now exists for it.

## Inputs to confirm

Before editing, make sure you have:
- **Name** (display, e.g. "LangChain") and **slug** (kebab-case URL segment, e.g. `langchain`).
- **Section** the card belongs to on the index (e.g. "Editor & Agent Integrations"). If a fitting section doesn't exist, ask the user before inventing one.
- **Icon**, a Font Awesome / Lucide name Mintlify accepts (e.g. `crow`, `terminal`, `key`).
- **One-line description** for the index card, in the existing style: short, action-oriented, present tense.
- The integration's **native language** for code examples (Python, TypeScript, Go, etc.).
- A **3-4 sentence description** of what the partner does (used as the opening paragraph of the page).

If any of these are missing and not obvious from context, ask once and proceed.

## Required page structure

Every integration page lives at `integrations/<slug>.mdx` and follows this exact structure. The fixed sections are non-negotiable so pages are predictable to navigate; the **Usage** section is intentionally free-form so it can fit each tool.

```
---
title: "<Integration Name>"
description: "<One-line description, same tone as index card.>"
---

<Paragraph, what the integration partner does. 3-4 sentences. No heading.>

<Paragraph, what ZeroGPU does. Reused verbatim from the canonical
boilerplate below. No heading.>

## Overview
   A short prose summary (2-4 sentences) of what this guide covers, the
   scope, the audience, and what the reader will be able to do by the end.
   Not a bulleted TOC; write it as a paragraph.

## Cookbook
   Point readers to a runnable, real-world example for this integration.
   If a cookbook page or notebook exists (a `cookbook/<slug>.mdx` page or a
   Colab/Jupyter notebook), link it here and describe in one or two
   sentences what the example does, then invite the reader to check it out.
   If none exists yet, keep the heading and write a single line:
   "Cookbook coming soon." Optionally add a <Note> pointing at the
   [cookbook index](/cookbook/index) for more worked examples.

## Video walkthrough
   Embed if one exists; otherwise a single line: "Video walkthrough coming soon."
   Keep the heading either way so structure stays consistent across pages.

## Quickstart
   ### Prerequisites
       What the user needs before starting (account, runtime version, etc.).
       Link the API key page (https://platform.zerogpu.ai/dashboard) and the
       model catalog (/docs/model-catalog).
   ### Get your ZeroGPU API key
       Short steps to create and copy an API key.
   ### Install <integration>
       Install command for the integration in its native package manager.
   ### Your first request
       Smallest possible end-to-end working snippet, env vars set, client
       initialized, one call made, response shown. Must reference
       ZEROGPU_API_KEY and the base URL https://api.zerogpu.ai/v1.

## Usage
   Free-form, integration-specific, and **deliberately detailed**, this is
   where the page earns its keep. The Quickstart proves the integration
   works; everything from here on is the real reference users come back to.
   Subheadings vary per integration, pick whatever genuinely fits the
   surface area, whether that's classes, functions, CLI commands, slash
   commands, model wrappers, tool wrappers, plugin entry points, REST
   endpoints, config blocks, decorators, hooks, or middleware.

   Use generic language ("entry point", "surface", "primitive") inside
   this skill, the concrete noun ("ChatModel", "skill", "tool", "client",
   "adapter") is whatever that specific integration ships, and you should
   use the integration's own terminology on the page itself.

   Depth expectations:
   - Cover **every** meaningful entry point the integration exposes for
     ZeroGPU, not just the highlights. If it ships 12 of them, document
     all 12.
   - For each entry point, include: what it does, which ZeroGPU model or
     endpoint it hits, full argument / parameter table (name, required,
     default, description), a runnable example in the integration's
     native language, and the shape of the response. Use the same
     structure for every entry so the page is scannable.
   - Add a short "patterns / recipes" subsection at the end of Usage with
     2-4 cross-cutting workflows that combine multiple entry points (e.g.
     PII sanitation pipeline, cheap classifier in front of a chat model,
     structured extraction over free-form parsing, routing by cost or
     latency). These teach judgment, not just syntax.
   - End Usage with a single at-a-glance reference table summarizing every
     entry point, one row each, so readers can find the right one quickly.

   Do not force a fixed template at the section level, the goal is to teach
   the integration well. But within Usage, keep per-entry structure
   consistent so the page stays predictable.

## Troubleshooting
   Recurring issues and fixes, written with the same depth as Usage.
   Aim for 6-12 entries that cover real failure modes a user of this
   specific integration will hit. Common candidates across integration
   types: install or PATH problems, missing / mistyped base URL, auth
   (401), authorization or project-scope (403), rate limits (429),
   schema / quoting / serialization errors, low-confidence or empty
   results, model or endpoint typos, streaming format mismatches,
   reload / cache / stale-state issues. Pick the ones that actually
   apply, don't pad. Each entry is a bolded symptom followed by the
   resolution in one or two sentences, including the exact command or
   config change when applicable.

## Conclusion
   Short wrap-up (2-4 sentences) tying the integration back to ZeroGPU's
   value, followed by a <CardGroup> with next-step links (typically: Model
   Catalog, API Reference, Cookbook, Discord). The card group lives inside
   the Conclusion section, there is no separate "Next steps" heading.
```

## Canonical ZeroGPU paragraph

Paste this as the second opening paragraph on every integration page so messaging stays consistent. Confirm with the user before changing wording in a one-off page.

> ZeroGPU is an ultra-fast, compute-efficient inference provider for apps and agents. We run purpose-built small and nano language models across an edge-powered network for the high-volume, purpose-specific tasks your app or agent runs constantly. Plug in our OpenAI-compatible API and you're live - zero GPU infrastructure, serverless, auto-scaling by default.

## Steps

1. **Create `integrations/<slug>.mdx`** following the structure above. See `EXAMPLE.md` for a fully written sample.

2. **Edit `integrations/index.mdx`:**
   - Add a `<Card title="..." icon="..." href="/integrations/<slug>">` to the appropriate live `<CardGroup>` (e.g. "Editor & Agent Integrations"). Keep cards alphabetical by title within their group unless another ordering is already in use.
   - If the integration was previously in the "Coming Soon" `<CardGroup>`, remove that card so it doesn't appear in both places.

3. **Edit `docs.json`:** add `"integrations/<slug>"` to the `pages` array of the Integrations tab's group, inserted alphabetically by slug after `"integrations/index"`. Do not reorder unrelated entries.

4. **Normalize dashes:** the repo convention (see `CLAUDE.md`) is ASCII hyphens only, no em (`-`) or en (`-`) dashes in prose. Check your new prose by hand and fix any that slipped in.

5. **Verify (recommended):** run `mint validate` to catch broken nav references or frontmatter issues before handing back.

## Things to avoid

- Leave the API-reference files alone unless that's your task. `api-reference/openapi/zerogpu.openapi.json`, `api-reference/openapi/playgrounds/*.openapi.json`, and the `api-reference/models/<model-id>.mdx` pages are committed, hand-maintained files (the old `scripts/` generators were removed), see `CLAUDE.md`.
- Do not invent new top-level navigation tabs.
- Do not add a card to the live grid without a real backing `.mdx` file, broken links fail `mint validate`.
- Do not duplicate a card across "Coming Soon" and a live section.
- Do not add a separate "Next steps" H2, the next-step cards belong inside the Conclusion.
