---
name: youtube-description
description: Generate a ready-to-paste YouTube title and description for a ZeroGPU video, anchored to a specific docs page (an integration, cookbook, model, or concept) with correct, verified links pulled from the repo. Use this skill whenever the user asks to "create a YouTube description", "write a video description", "make a description for my YouTube video", "give me a title and description for this video", or is recording/posting a video about a ZeroGPU feature and needs the description box content. Encodes the repo's canonical links and the established description layout so every link resolves and nothing is invented.
---

# youtube-description

Produce a single YouTube **title** and a ready-to-paste **description** for a video about a ZeroGPU topic. The output goes in `youtube/<topic-slug>.md` (one file per video, named after the anchor topic, e.g. `youtube/claude-code-plugin.md`) so the user can copy the body straight into YouTube's description box. Create the `youtube/` directory if it does not exist.

The whole point is that the user pastes this without editing, so two things must hold:
- **Every link must resolve and nothing may be invented.** Links come from the repo (`docs.json` for socials/nav, the anchor `.mdx` for content), not from memory.
- **No angled brackets (`<` or `>`) in the paste-able body.** YouTube treats `<...>` as HTML and strips or mangles it, so a line like `/zerogpu-router:<name>` would render broken. Write concrete values instead (`/zerogpu-router:redact-pii`), never placeholder angle brackets.

## When to use

The user is making or posting a YouTube video about a ZeroGPU feature and needs the description box filled. Triggers: "create a YouTube description", "write a video description for X", "give me a title and description", "I'm posting a YouTube video about the Claude Code plugin." Usually the video is about one specific thing (an integration, a cookbook walkthrough, a model, a concept) which becomes the **anchor page**.

## Inputs to confirm

Most of this you can infer; ask only if genuinely unclear.

- **Anchor topic / page** the video is about. Map it to a docs slug, e.g. the Claude Code plugin video -> `integrations/claude-code-plugin`. If the user names a feature but not a page, find the closest `.mdx` (search `integrations/`, `cookbook/`, `models/`, `concepts/`).
- **Number of titles**: default to **one** title. Only produce several if the user explicitly asks for options. (Users have asked for exactly one before; don't volunteer a list.)

If the anchor is ambiguous (the topic could map to two pages), ask once, otherwise proceed with the best match.

## How to build it

### 1. Resolve the links from the repo, do not invent them

- **Base URL** for all doc links: `https://docs.zerogpu.ai`. A nav slug like `integrations/claude-code-plugin` becomes `https://docs.zerogpu.ai/integrations/claude-code-plugin`.
- **Social / platform links**: read them from `docs.json` (`navbar.links`, `navbar.primary`, `footer.socials`) rather than typing them from memory, they change. As of now they are:
  - Website: `https://zerogpu.ai`
  - Platform / Dashboard: `https://platform.zerogpu.ai`
  - GitHub: `https://github.com/zerogpu`
  - Discord: `https://discord.gg/Ad5KZvAyky`
  - X (Twitter): `https://x.com/ZeroGPU_AI`
- **Anchor page links** (model catalog, dashboard, API key, batch, etc.): reuse the exact URLs the anchor `.mdx` already links to. If the page links `https://platform.zerogpu.ai/dashboard` for the API key, use that.
- Verify each slug you cite actually exists in `docs.json` navigation. If you reference a page, it should be a real nav entry.

### 2. Read the anchor page for real content

Open the anchor `.mdx` and pull the substance from it, do not paraphrase from imagination:
- **Intro blurb**: base it on the page's own `description` and Overview prose. Say what the video shows and why it matters (the page's "Conclusion" / value props are good source material).
- **Commands the viewer can copy**: if the page documents install/setup commands (e.g. the `/plugin` commands or `npm install -g` lines), lift them verbatim into a "Quick install" / "Prerequisites" block. These are high-value for a video description.
- **Feature list**: if the page enumerates skills/commands/capabilities, summarize them as a short keyword-rich list (helps YouTube search).

### 3. Assemble the output file

Write `youtube/<topic-slug>.md` using this layout. Keep the divider so it's obvious what to copy. Everything in angle brackets below is an instruction to you, the author, fill it in with real content. The finished file must contain zero `<` or `>` characters in the body (below the divider); the only allowed `>` is the blockquote marker on the "Copy everything below the divider" note, which sits above it.

```
# YouTube Video Description: <Topic>

> Copy everything below the divider into the YouTube description box.

## Title

<One title. Specific, keyword-rich, <~70 chars. Lead with the concrete value.>

---

<2-3 sentence intro: what the video shows + why it matters. Plain prose, no heading.>

<Optional: a short "why it matters" line drawn from the page's value props.>

<Optional emoji-headed "Quick install" / commands block, verbatim from the page.>

<emoji> Featured in this video
<Anchor page link first, then the 3-5 most relevant supporting links: dashboard, model catalog, quickstart.>

<emoji> Skills / features shown   (only if the page enumerates them)
<short list>

<emoji> Documentation
<docs home, API reference, batch, cookbook, FAQ as relevant>

<emoji> Core Concepts        (nano-language-models, distributed-inference, geo-aware-routing)

<emoji> SDK Examples         (python, javascript, rust, go, ruby)

<emoji> Connect with us
Website / Platform / GitHub / Discord / X   (from docs.json)

#ZeroGPU #<TopicTags> ...
```

Section guidance:
- **Lead with the anchor.** The first links and the intro are about the video's actual subject. Generic docs links come after. A plugin video leads with the plugin guide and install commands, not the homepage.
- **Emoji headers** (⚡ 🔗 🛠️ 📚 🧠 💻 🧰) match the docs' own voice (the cookbook and integration pages use emoji section heads). Keep them light.
- **Include only relevant sections.** A concept-explainer video may not need an SDK list. Don't pad.
- **Hashtags**: end with 6-10, mixing the evergreen ones (`#ZeroGPU #AI #LLM #DeveloperTools`) with topic-specific ones (`#ClaudeCode #Anthropic #PII` for the plugin).

### 4. Sanity-check before finishing

- No em or en dashes in the prose (repo convention is ASCII hyphens only).
- **No `<` or `>` in the paste-able body** (the blockquote marker above the divider is the only exception). Grep the file for angle brackets before finishing; if any survive (often a `:<name>`-style placeholder or a `<text>` arg from a doc page), rewrite them with a concrete example.
- One title, unless the user asked for several.
- Every URL is either a verified `docs.zerogpu.ai/<real-slug>` or a social link copied from `docs.json`.
- The body reads top-to-bottom as something a viewer would actually want, not a raw sitemap dump.

Tell the user the file path and that the title is separate from the paste-able body. Offer to trim to a "top links only" short version if they want something more compact.

## Example anchor mapping

**Input:** "Create a YouTube description for my video on the Claude Code plugin."
- Anchor page: `integrations/claude-code-plugin`
- Title: `Run Claude Code Skills on ZeroGPU's Nano Models (PII Redaction, Classification & More)`
- Featured-first links: the plugin guide, dashboard API key, model catalog, quickstart.
- Quick install block: the `/plugin marketplace add` / `/plugin install` / `/reload-plugins` commands lifted from the page.
- Skills-shown list: redact-pii, extract-pii, classify-* , extract-* , chat, summarize.
- Hashtags: `#ZeroGPU #ClaudeCode #AI #LLM #DeveloperTools #PII #Anthropic`.
