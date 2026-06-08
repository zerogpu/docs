---
name: cookbook
description: Author a notebook-style cookbook `.mdx` page under `cookbook/` that walks a reader end-to-end through combining ZeroGPU with another framework, platform, or SDK (CAMEL, LangChain, LlamaIndex, CrewAI, AutoGen, a Claude Code plugin, an Electron app, etc.). The skill encodes the established cookbook template: emoji-headed sections, "In this notebook, you'll explore:" tool bullets, `getpass` key setup, alternating prose-and-code cells with illustrative outputs, a `🌟 Highlights` recap, and the canonical ZeroGPU blurb. Use this skill whenever the user asks to "create a cookbook", "write a cookbook for X with ZeroGPU", "draft a cookbook combining X and ZeroGPU", "add a tutorial notebook for X", or otherwise wants a notebook-style integration walkthrough authored in ZeroGPU's cookbook voice and structure.
---

# Cookbook

Produces a single `.mdx` cookbook page in `cookbook/<slug>.mdx` that mirrors the structure, formatting, and language of the established ZeroGPU notebook-style cookbooks. These are tutorial walkthroughs that pair a framework or platform with ZeroGPU around a concrete task: the reader scrolls top-to-bottom, alternating between prose and runnable code cells, with realistic example output shown beneath each cell so they can follow along without executing it.

The user provides the *content* (which framework, which ZeroGPU capability, which task). The skill provides the *form*.

## When to use this skill

Trigger on phrasings like:

- "Create a cookbook for `<framework>` with ZeroGPU"
- "Write a cookbook combining `<X>` and ZeroGPU"
- "Add a cookbook showing `<X>` powered by ZeroGPU"
- "Draft a tutorial notebook for `<X>` integration"

## What to gather before writing

Ask the user for whatever is missing, never invent these:

1. **Title**, descriptive name with a leading emoji. Use the framework's mascot when it has one (🐫 CAMEL, 🦜 LangChain, 🦙 LlamaIndex, 👥 CrewAI), otherwise pick a thematic emoji.
1b. **Description**, a one-sentence frontmatter `description` summarizing what the cookbook does. This is **required** on every page. Mintlify feeds it into the auto-generated `llms.txt`/`llms-full.txt` entry (truncated at 300 characters and the first line break) and into the page's SEO metadata. If the user does not supply one, write it yourself from the intro paragraph; do not leave it blank. Keep it under 300 characters, on one line, no leading emoji, ASCII hyphens only.
2. **Framework / platform** being paired with ZeroGPU: its install command, the canonical 1-2 sentence description for the intro bullet, and its key-management story (which env var, where to get the key).
3. **Concrete task** the cookbook walks through (e.g. "build a multi-agent travel planner using real-time weather", "summarize a long support thread inside an Electron app", "route Claude Code subagents through ZeroGPU's nano models").
4. **ZeroGPU capability** to feature, chat (`LFM2.5-1.2B-Instruct`), thinking (`LFM2.5-1.2B-Thinking`), classification (zero-shot, IAB, structured), extraction (entities, PII, JSON), summarization. Pick one as the headline, mention adjacent ones only if the task genuinely uses them.
5. **Other tools** in the stack (OpenAI, AgentOps, a vector DB, etc.) so the intro bullets and Highlights recap can list them with consistent descriptions.
6. **Optional Colab link** and **optional YouTube video ID**. If the Colab link is not supplied, omit that line, do not insert a placeholder URL. The video section is *always* present: when a YouTube video ID is supplied, embed the iframe; when it is not, keep the section heading and write `Video walkthrough coming soon.` as the body. Never insert a placeholder video ID or a fabricated embed URL.
7. **Canonical reference page** for the framework being integrated. Every cookbook must link to its sibling reference page near the top so readers can jump to full docs:
   - Integration cookbook → `integrations/<slug>.mdx` (e.g. a Claude Code plugin cookbook links to `/integrations/claude-code-plugin`).
   - Model-focused cookbook → `models/<id>.mdx`.
   - Endpoint-focused cookbook → `/api-reference/...`.
   If a fitting reference page does not exist yet, flag it to the user before drafting.
8. **Slug**, kebab-case (e.g. `camel-travel-planner`, `claude-code-router`, `langchain-pii-redactor`).

## ZeroGPU canonical text (use verbatim)

These appear in the intro bullets and in the Highlights recap, **word-for-word identical** between the two locations. This deliberate repetition is part of the format.

**ZeroGPU blurb** (use in both the intro bullets and the Highlights recap):

> **ZeroGPU**: An ultra-fast, compute-efficient inference provider for apps and agents. We run purpose-built small and nano language models across an edge-powered network for the high-volume, purpose-specific tasks your app or agent runs constantly. Plug in our OpenAI-compatible API and you're live - zero GPU infrastructure, serverless, auto-scaling by default.

**OpenAI blurb** (when OpenAI is in the stack):

> **OpenAI**: A leading provider of advanced AI models capable of natural language understanding, contextual reasoning, and content generation. It enables intelligent, human-like interactions and supports a wide range of applications across various domains.

**ZeroGPU API key flow:**

- Dashboard: https://platform.zerogpu.ai/dashboard
- Key prefix: `zgpu-api-`
- Project ID is a UUID, also from the dashboard.
- Env vars: `ZEROGPU_API_KEY` and `ZEROGPU_PROJECT_ID`.
- The "go get a key" line should say: *"You can go to [here](https://platform.zerogpu.ai/dashboard) to get an API key and Project ID from ZeroGPU. The key starts with `zgpu-api-` and the Project ID (UUID) is on the project settings page."*

## Page template

Follow this section order exactly. Sections marked *optional* are only included when the user supplies the relevant content. The one exception is the **🎥 Watch the Video Guide** section: it is *always* present. Embed the iframe when a video ID is supplied; otherwise keep the heading and write `Video walkthrough coming soon.` as the body.

````mdx
---
title: "<emoji> <Descriptive Title>"
description: "<One-sentence summary of what this cookbook does. Required. No leading emoji, one line, under 300 characters, ASCII hyphens only. Feeds the auto-generated llms.txt entry and SEO metadata.>"
---

You can also check this cookbook in colab [here](<colab-url>).   <!-- optional -->

<One-paragraph framing: what the notebook demonstrates, ending with a sentence
like "By combining <Framework> and ZeroGPU, this notebook walks you through ...".
Include a link to the canonical reference page so the reader knows the full docs
exist: "For the full reference, see the [<X> integration guide](/integrations/<slug>)."
This link is mandatory.>

In this notebook, you'll explore:

- **<Framework>**: <1-2 sentence description of the framework and what role it plays here.>
- **ZeroGPU**: An ultra-fast, compute-efficient inference provider for apps and agents. We run purpose-built small and nano language models across an edge-powered network for the high-volume, purpose-specific tasks your app or agent runs constantly. Plug in our OpenAI-compatible API and you're live - zero GPU infrastructure, serverless, auto-scaling by default.
- **<Other tool, e.g. OpenAI>**: <canonical description, see "ZeroGPU canonical text" above for OpenAI.>
- **<Other tool, e.g. AgentOps>**: <description.>

<Closing paragraph: "This setup not only demonstrates a practical application of
... but also provides a flexible framework that can be adapted to other real-world
scenarios requiring <broad capability phrase>." Keep the cadence of the source
template.>

## 🎥 Watch the Video Guide   <!-- always present; embed below when a video ID is supplied -->

<!-- When NO video ID is supplied, keep this heading and use exactly this body instead of the iframe:

Video walkthrough coming soon.

-->

If you prefer a visual walkthrough, check out the accompanying video guide below:

<iframe
    width="560"
    height="315"
    src="https://www.youtube.com/embed/<VIDEO_ID>"
    title="YouTube video player"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    referrerpolicy="strict-origin-when-cross-origin"
    allowfullscreen
></iframe>

## 📦 Installation

First, install the <Framework> package with all its dependencies:

```bash
!pip install "<package-spec>"
```

<If ZeroGPU has its own SDK install line for this stack, include it as a second
fenced bash block; otherwise note that ZeroGPU is reached via the OpenAI-compatible
client and link to /integrations/<slug> for the exact setup.>

## 🔑 Setting Up API Keys

You'll need to set up your API keys for <list every service used, in order>.
This ensures that the tools can interact with external services securely.

You can go to [here](https://platform.zerogpu.ai/dashboard) to get an API key and Project ID from ZeroGPU. The key starts with `zgpu-api-` and the Project ID (UUID) is on the project settings page.

```python Python
import os
from getpass import getpass

# Prompt for the ZeroGPU API key and Project ID securely
zerogpu_api_key = getpass('Enter your ZeroGPU API key: ')
os.environ["ZEROGPU_API_KEY"] = zerogpu_api_key

zerogpu_project_id = getpass('Enter your ZeroGPU Project ID: ')
os.environ["ZEROGPU_PROJECT_ID"] = zerogpu_project_id
```

You can go to [here](<link-to-other-provider-keys-page>) to get an API key from <Provider>.

```python Python
# Prompt for the API key securely
<provider>_api_key = getpass('Enter your API key: ')
os.environ["<PROVIDER>_API_KEY"] = <provider>_api_key
```

<Repeat the getpass block for each additional service. When a provider advertises
a free tier (e.g. AgentOps), include the word "free" in the link line, matching
the source template's cadence.>

<Optional: a short paragraph + code block that initializes the framework's
client/model, e.g. ModelFactory.create(...) for CAMEL, ChatOpenAI(...) for
LangChain, openai.OpenAI(base_url="https://api.zerogpu.ai/v1", ...) when going
through ZeroGPU's OpenAI-compatible surface.>

## <emoji> <Optional preliminary section, e.g. "📹 Monitoring AI Agents with AgentOps">

<Short prose, one code block, one output block.>

## <emoji> Access <Capability> with ZeroGPU

ZeroGPU is an ultra-fast, compute-efficient inference provider for apps and agents. We run purpose-built small and nano language models across an edge-powered network for the high-volume, purpose-specific tasks your app or agent runs constantly. Plug in our OpenAI-compatible API and you're live - zero GPU infrastructure, serverless, auto-scaling by default. In this section, we will <briefly state the standalone demo, e.g. "redact PII from a support ticket as an example.">

```python Python
<minimal standalone call to ZeroGPU showing the headline capability, usually
through the OpenAI-compatible client or the framework's ZeroGPU integration.>
```

```
<Realistic example output, verbatim-style. Include emojis, formatting, and
framework-specific log chatter when relevant.>
```

🎉 **ZeroGPU effortlessly <one-line outcome>, providing <value phrase> for AI integration!**

## <emoji> <Main scenario header, e.g. "🤖🤖 Multi-Agent Role-Playing with CAMEL">

_<One-sentence italic framing of what this section does and how ZeroGPU plugs in.>_

```python Python
<imports>
```

<Short prose introducing the next step, e.g. "Defining the Task Prompt">

```python Python
<code>
```

<Continue alternating short prose paragraphs (1-3 sentences) with code blocks.
After any cell whose output is interesting, a model response, an agent turn,
a final result, include an unlabeled fenced ``` block beneath it that shows
realistic example output verbatim-style (with emojis, bullet lists, framework
log lines, etc.). Outputs are part of the reader's expected experience and
should not be summarized.>

```python Python
<final cell, e.g. ending the AgentOps session, printing the final answer,
closing a client>
```

```
<final output, e.g. session stats line>
```

🎉 <One-sentence outro tying the run back to the takeaway. Mention any private
links (AgentOps replay, dashboard) and note they are tied to the reader's own
account.>

## 🌟 Highlights

This notebook has guided you through setting up and running a <Framework> workflow with ZeroGPU for <task>. You can adapt and expand this example for various other scenarios requiring <broad capability phrase>.

Key tools utilized in this notebook include:

- **<Framework>**: <same description as the intro bullet, verbatim.>
- **ZeroGPU**: An ultra-fast, compute-efficient inference provider for apps and agents. We run purpose-built small and nano language models across an edge-powered network for the high-volume, purpose-specific tasks your app or agent runs constantly. Plug in our OpenAI-compatible API and you're live - zero GPU infrastructure, serverless, auto-scaling by default.
- **<Other tool>**: <same description as the intro bullet, verbatim.>
- **<Other tool>**: <same description as the intro bullet, verbatim.>

This comprehensive setup allows you to adapt and expand the example for various scenarios requiring <repeat capability phrase>.
````

## Voice and style rules

These are the things that make a page read like a ZeroGPU cookbook rather than generic tutorial boilerplate. Follow them unless the user explicitly overrides.

- **Conversational, lightly enthusiastic tone.** Short paragraphs of 1-3 sentences between code blocks. Phrases like "First,", "Now,", "Let's", and "Here's" are fine and on-voice. Cookbooks are friendly walkthroughs, not API reference.
- **Second person ("you", "you'll").** Talk to the reader directly. Avoid "we will lead the user through" framings.
- **Code fence labels.** Use `` ```bash `` for shell (note the leading `!` on pip lines, mirroring notebook conventions), `` ```python Python `` for runnable Python (the trailing `Python` is the Mintlify tab label), and an unlabeled `` ``` `` fence for example outputs.
- **`getpass` for every key.** Every API key is read with `getpass(...)` and written to `os.environ`. ZeroGPU's section reads two values: API key and Project ID. Do not hard-code keys, do not use `input()`, do not skip the comment line above each prompt.
- **The canonical ZeroGPU blurb appears at least twice**, once in the intro bullet list, once in the Highlights bullet list, and is word-for-word identical. The longer "Access <Capability> with ZeroGPU" section opens with the same blurb followed by a "In this section, we will..." sentence. This is deliberate; do not paraphrase.
- **Free credits callout.** When a provider in the stack (AgentOps, etc.) advertises a free tier, include the word **free** in the link line, matching the source template's cadence.
- **Emoji section headers.** *Every* top-level section header uses a leading emoji, no exceptions. Required: `📦 Installation`, `🔑 Setting Up API Keys`, `🎥 Watch the Video Guide`, `🌟 Highlights`. Use a thematic emoji for capability and scenario sections: `🛰️` for real-time data, `📹` for monitoring/observability, `🤖🤖` for multi-agent, `🧠` for reasoning, `🔎` for search/research, `📰` for news, `💹` for finance, `🧵` for chains, `🔐` for privacy/PII, `🎙️` for chat.
- **Show outputs.** After any code cell whose output is meaningful (an agent reply, a search result, a final summary), include an unlabeled fenced block beneath it with a realistic example output. Outputs may include emojis, casual phrasing, and the framework's own logs (e.g. `🖇 AgentOps: Replay: ...`), they are part of the reader's expected experience.
- **🎉 outros.** After the "Access <Capability> with ZeroGPU" demo and at the end of the main scenario, include a single `🎉 ...` sentence summarizing what just happened.
- **Always link to the canonical reference doc up front.** The opening paragraph must point the reader to the full reference page for the thing the cookbook builds on (integration page, model page, endpoint page). The cookbook covers *one task*; the reference covers the *full surface*.
- **Frontmatter `description` is required.** Every page must have a one-line `description` in its frontmatter alongside `title`. Mintlify auto-generates `llms.txt`/`llms-full.txt` from these descriptions (truncated at 300 characters and the first line break), so a missing one produces a weak, auto-derived entry. No leading emoji, one line, under 300 characters, ASCII hyphens only.
- **ASCII hyphens only.** Per repo convention, no em or en dashes anywhere in prose. Check by hand after writing and fix any that slipped in.
- **No invented URLs.** Use only URLs the user supplied or canonical pages (the ZeroGPU dashboard above, the standard YouTube embed URL pattern, the integration page slug). Do not fabricate Colab links, video IDs, or dashboard URLs.
- **Video section always present.** The `## 🎥 Watch the Video Guide` section is never omitted. When the user supplies a YouTube video ID, embed the iframe. When they do not, keep the heading and write `Video walkthrough coming soon.` as the body, never a placeholder ID or a fabricated embed URL. (The Colab link, by contrast, stays optional and is dropped entirely when absent.)
- **Final "🌟 Highlights" recap.** Always end with the Highlights section. The bullet list there mirrors the intro bullet list, same tools, same descriptions, intentionally repeated so a reader who skipped to the end gets the same framing.

## After writing

1. Save to `cookbook/<slug>.mdx` (kebab-case slug derived from the title). Confirm the frontmatter has both `title` and a non-empty `description`.
2. Add the new slug to the Cookbook group in `docs.json` (under the `"tab": "Cookbook"` entry, around line 175). Place it next to thematically related entries.
3. Add a `<Card>` to the `<Columns cols={2}>` grid in `cookbook/index.mdx`:
   ```mdx
   <Card title="<Short title>" icon="<lucide-icon-name>" href="/cookbook/<slug>">
     <One-sentence description.>
   </Card>
   ```
   Use icons already on the index (`rocket`, `file-text`, `tags`, `database`, `graduation-cap`, `layers`).
4. Check for em/en dashes by hand and replace them with ASCII hyphens.
5. Run `mint validate` to confirm `docs.json` parses.
6. If `mint dev` is running, the page will hot-reload at `http://localhost:3000/cookbook/<slug>`.

## Example: what a good intro looks like

For a "Claude Code subagent router using ZeroGPU's nano models" cookbook, the intro should read roughly:

```mdx
---
title: "🤖 Claude Code Subagent Router: Offload Cheap NLP Tasks to ZeroGPU's Nano Models"
description: "Set up the zerogpu-router plugin so Claude Code can hand off classification, extraction, and short chat tasks to ZeroGPU's nano models, cutting token spend and keeping PII out of context."
---

This notebook demonstrates how to set up the `zerogpu-router` plugin so that Claude Code can hand off classification, extraction, and short chat tasks to ZeroGPU's nano models without leaving your terminal session. By combining Claude Code's plugin system with ZeroGPU's edge-optimized models, this notebook walks you through a practical pattern for cutting token spend on well-defined NLP work while keeping raw PII out of Claude's context.

For the full reference, see the [Claude Code plugin integration guide](/integrations/claude-code-plugin).

In this notebook, you'll explore:

- **Claude Code**: Anthropic's agentic coding tool that runs Claude directly in your terminal, with file editing, command execution, and a plugin system that extends sessions with custom slash commands and skills.
- **ZeroGPU**: An ultra-fast, compute-efficient inference provider for apps and agents. We run purpose-built small and nano language models across an edge-powered network for the high-volume, purpose-specific tasks your app or agent runs constantly. Plug in our OpenAI-compatible API and you're live - zero GPU infrastructure, serverless, auto-scaling by default.
```

Notice the ZeroGPU bullet uses the canonical blurb verbatim, only the Claude Code bullet is freshly written for this scenario, and the second paragraph links straight to `/integrations/claude-code-plugin` so the reader can find the full documentation in one click.
