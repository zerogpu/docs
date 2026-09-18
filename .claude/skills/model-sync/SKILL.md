---
name: model-sync
description: Reconcile the ZeroGPU docs with the live model catalog API (https://api-dashboard.zerogpu.ai/api/models), which is the sole source of truth — add models the docs are missing, correct every value that disagrees with it, and remove models it no longer returns, across `docs/model-catalog.mdx`, the task pages (`docs/text-generation.mdx`, `docs/text-classification.mdx`, `docs/moderation.mdx`, `docs/embeddings.mdx`, `docs/pii.mdx`, `docs/ad-tech.mdx`, `docs/open-weight.mdx`), `api-reference/models/`, the playground specs, the shared OpenAPI model enums, and the `docs.json` nav — then cut a branch from `main`, commit, and open a PR automatically. Runs unattended — it never asks questions. Use this skill whenever the user asks to "check for new models", "which models are missing from the docs", "sync the model catalog", "fetch models from the dashboard API and compare", "add the new model to the docs", "fix the pricing/context windows", or schedules a routine to keep the documented model set matched to what the API serves.
---

# Model sync

`https://api-dashboard.zerogpu.ai/api/models` **is the sole source of truth.** Its response defines which models exist and every machine-readable fact about them — task, context window, pricing, parameter count, favicon. Where the docs disagree, the docs are wrong and this skill corrects them: table cells, card pills, blockquote blurbs, frontmatter, counts, nav, OpenAPI enums, and playground specs.

**This skill runs unattended.** It asks nothing and waits for nothing. Every decision below is a rule with a determined answer, so a scheduled run and an interactive run do the same thing. When a rule leaves genuine slack — the wording of a new blurb, where in a table to insert a row — pick the option most consistent with the surrounding page and note the choice in the final summary. Never end a run with an open question, a "should I…", or work deferred for a human.

Work the three loops in order: **[correct](#1-correct-what-disagrees)**, **[add](#2-add-what-is-missing)**, **[remove](#3-remove-what-is-gone)**. Then [verify](#4-verify), and [branch and open a PR against `main`](#5-branch-and-open-the-pr) — every run that changes a file ends in a PR, without being asked.

## Step 0 — audit

```bash
python3 .claude/skills/model-sync/scripts/audit-models.py
```

| Label | Meaning | Handled by |
| --- | --- | --- |
| `DRIFT` | a markdown **table cell** disagrees with the API | `--fix` |
| `PROSE` | a pill, blurb, or sentence states a stale number, with `file:line` | you, by hand — [loop 1](#1-correct-what-disagrees) |
| `MISSING` | a docs surface has no entry for a model the API returns | you — [loop 2](#2-add-what-is-missing) |
| `ORPHAN` | a documented model the API does not return, plus every file to clean | you — [loop 3](#3-remove-what-is-gone) |
| `NOTE` | an unused favicon, an unmapped task, a curated page listing a model outside its table | you, by applying the rules below |

Flags: `--fix` (rewrite drifting table cells), `--model <id>` (one model, repeatable), `--save` / `--json` (snapshot then re-run offline), `--strict` (exit 1 when anything is reported).

**Abort conditions.** If the fetch fails, times out, or returns zero models, change nothing, say the sync did not run, and stop. A partial or empty payload must never be treated as "the API removed everything". This is the one case where the skill does less than a full sync — it is a failure to report, not a question to ask.

Fields the script does not print:

```bash
curl -s https://api-dashboard.zerogpu.ai/api/models | python3 -m json.tool
```

## 1. Correct what disagrees

```bash
python3 .claude/skills/model-sync/scripts/audit-models.py --fix
```

Rewrites every drifting table cell — input, output, max tokens, task — across the catalog, task pages, and curated pages. Nothing else: a cell is unambiguous, a sentence is not.

Then work each `PROSE` line by hand. Each names the file, the line, and both values.

- **Card pills** in `docs/model-catalog.mdx` and `docs/open-weight.mdx`: `<span …>262,144 context window</span>`, `<span …>\$1.10 / 1M input</span>` — note the escaped `\$`.
- **The blockquote blurb**, which is the same text in three places per model: the catalog card (truncated, ending `…`), the `## <id>` section on the task page, and `api-reference/models/<slug>.mdx`. Fix all three; the audit lists each.
- **Frontmatter `description`** on the model page, which often restates the context window.
- **Rounded restatements**: `1,048,576-token (1M) context`, `Its 128K-token context window`. The audit accepts every correct form (`262,144`, `256K`, `0.25M`) and flags only wrong ones. When a whole clause stops being true — "sustains a solid 1M context", "when the work spans million-token documents" — rewrite the clause rather than swapping digits, keeping the sentence's voice and length.
- **Counts**: the `N models:` line on each `Model library by task` card in the catalog, and intro sentences like "ZeroGPU serves five of them" on `docs/open-weight.mdx`.

The script only scans the catalog, task pages, curated pages, and model pages. Numbers are also copied into integration and cookbook pages, which it does not parse, so sweep them for every value you changed:

```bash
grep -rn "1,048,576\|1M context\|4,000" --include="*.mdx" --include="*.md" . | grep -v api-reference/openapi
```

`integrations/hermes.mdx` in particular carries its own model table with backticked ids that the parser skips.

## 2. Add what is missing

A model in the API but absent from the docs needs all seven surfaces. A half-added model leaves broken links and wrong counts, so finish all of them in one run.

### 2.1 `docs/model-catalog.mdx` — three places

**At a glance** row (copy the nearest existing row; the inline styles are load-bearing — they kill the link underline and let long ids wrap):

```mdx
| <a href="/api-reference/models/<slug>" style={{display:"inline-flex",alignItems:"center",gap:"0.5rem",textDecoration:"none",color:"inherit",wordBreak:"break-word",borderBottom:"none"}}><img src="<favicon_url>" alt="<modelId>" width="22" height="22" noZoom /> <code><modelId></code></a> | $0.02 | $0.05 | — | <Task> | 400 |
```

Columns: Input /1M, Output /1M, Cached input /1M (`cached_input_per_1m_tokens` when positive, else `—`), Task, Max tokens with thousands separators. Embedding models use `Not billed` for output. Omit the `<img>` when `favicon_url` is null. Insert by descending `displayPriority` relative to its neighbours; never reshuffle existing rows.

**Detailed model card** in the `<CardGroup cols={2}>`: 32×32 icon, pills for context window / input / output / cached input (`\$` escaped), then the blurb truncated with `…`.

**Model library by task**: add the id to its task card and bump that card's `N models:` count.

### 2.2 The task page

Both of:

- a row in that page's pricing table — same markup, but the columns differ per page (`docs/text-generation.mdx` and `docs/open-weight.mdx` carry a Cached input column; the others do not), and
- a `## <modelId>` section, positioned to match table order, containing: the `<Note>` block if the model is [Chat-Completions-only](#endpoint-support), a `>` blockquote blurb, the `**References:**` line, a `<CodeGroup>` with `bash Responses API` + `bash Chat Completions` (a single `bash Chat Completions` block when there is no Responses support), one sentence on what comes back, and a fenced ` ```json Response ` / ` ```text Response ` example.

Request bodies come from `sample_responses_body` / `sample_chat_completions_body`, pretty-printed at 2 spaces, against `https://api.zerogpu.ai/v1/responses` or `/v1/chat/completions`, with `-H "content-type: application/json"`, `-H "x-api-key: YOUR_API_KEY"`, `-H "x-project-id: YOUR_PROJECT_ID"`. Response examples must come from the API's samples — if a sample body is absent, write the request block and omit the response block rather than inventing one.

Moderation and embedding models are routable **only** on `/v1/moderations` and `/v1/embeddings`; their sections use that endpoint.

#### Endpoint support

The payload does **not** say which endpoints a model is routable on, and a null `sample_responses_body` is not evidence of one: `llama-3.1-8b-instruct-fast` has no Responses sample yet is fully supported on `/v1/responses`, with the quickstart built on it. So:

- For a model already in the docs, the existing OpenAPI enums and `<Note>` blocks are authoritative. Never add or remove an enum entry because a sample body is present or absent — the only enum finding worth acting on is a model absent from *both* the Responses and Chat enums, which means it was never wired up.
- For a **new** model, take Chat Completions from `sample_chat_completions_body`, and add Responses support only when `sample_responses_body` exists. When it does not, add the model to the Chat enum only and give its section the Chat-Completions-only `<Note>` — then say so in the summary, since the docs can be widened later once a Responses sample or an explicit confirmation exists.

**Task page selection** is mechanical, via the [task mapping](#task-mapping). If `taskDisplayName` maps to nothing, create `docs/<kebab-case-task>.mdx` from the structure of the closest existing task page (frontmatter `title`/`description`, one-paragraph intro, pricing table, one `## <id>` section per model), add it to the Documentation → **Models** nav group in `docs.json` after `docs/model-catalog`, add a matching `Model library by task` card to the catalog, and record the new page in the summary.

**Curated-page membership** is also mechanical, not editorial:

- `docs/open-weight.mdx` — add the model when its task maps to `docs/text-generation.mdx` **and** `pricing.terms_url` points at an upstream licence (a `huggingface.co`, `github.com`, or model-vendor URL) rather than `zerogpu.ai/terms`. Then update that page's table, its model card, and the "ZeroGPU serves five of them" count in the intro.
- `docs/ad-tech.mdx` — add the model when its `modelType` or `modelId` contains `iab`. Then update its table and the catalog's `Ad Tech` card count.

### 2.3 `api-reference/models/<slug>.mdx`

```mdx
---
title: "<modelId>"
sidebarTitle: "<the id itself, or a 1–3 word label like \"Moderation\" / \"MiniLM Embeddings\">"
description: "Model details for <modelId>. <one short factual clause>."
openapi: "api-reference/openapi/playgrounds/<playground-slug>.openapi.json POST /responses"
---

> <blurb — the same text as the task-page blockquote>

**References:** [Model docs](…) • [Terms](…) • [Privacy](…)
```

Use `POST /chat/completions`, `/moderations`, or `/embeddings` in the `openapi` line when the model has no Responses support.

### 2.4 `api-reference/openapi/playgrounds/<playground-slug>.openapi.json`

Clone the closest playground for the same task and change only: `info.title`/`description`, `operationId` (`createResponse_<playground-slug>`), `summary`, `tags`, the pinned `model` schema (`const`/`default`/`example` all the exact `modelId`), and `examples` — one per use case from the API's sample bodies, plus one per `modelUsecases` key. Keep `servers`, `security`, and `components.schemas` byte-identical to the sibling.

### 2.5 `api-reference/openapi/zerogpu.openapi.json`

Add the id to `CreateResponseRequest.properties.model.enum` and/or `CreateChatCompletionRequest…enum`, per [Endpoint support](#endpoint-support). Embedding models go in `CreateEmbeddingRequest…enum`; a moderation model becomes the `default`/`example` of `CreateModerationRequest…model`, which has no enum.

### 2.6 `docs.json`

Add `"api-reference/models/<slug>"` to API Reference → Endpoints → **By model**, next to related models.

### 2.7 Re-audit that model

`--model <new-id>` must come back with no `MISSING` and no `DRIFT`.

## 3. Remove what is gone

A model page the API does not return is removed, in full, without asking. The audit prints every file that mentions it under `REMOVE:`; work that list to completion:

1. **Delete** `api-reference/models/<slug>.mdx` and `api-reference/openapi/playgrounds/<playground-slug>.openapi.json`.
2. **`docs.json`** — drop the `"api-reference/models/<slug>"` nav entry, and add a redirect so the live URL keeps resolving:
   ```json
   { "source": "/api-reference/models/<slug>", "destination": "/docs/model-catalog" }
   ```
   Point the redirect at the task page instead when that page still exists and still has models.
3. **`api-reference/openapi/zerogpu.openapi.json`** — remove the id from every enum (and from a `default`/`example` if it is named there; substitute a surviving model).
4. **`docs/model-catalog.mdx`** — delete the table row, the `<Card>`, and the id from its `Model library by task` cards, decrementing each `N models:` count.
5. **The task page and any curated page** — delete the table row and the whole `## <id>` section, and fix intro sentences that counted or named it.
6. **Integration, cookbook, and `skills/` pages** — replace the id with a surviving model of the same task where it is used as an example (keeping the sample body valid for that model), and delete the row or bullet where it is just listed.
7. **Cascade.** If removal empties a page — no models left in its table — delete that page too, drop it from the `docs.json` nav, redirect it to `/docs/model-catalog`, and remove its `Model library by task` card and any link to it. Do the same for an endpoint reference page whose only models are gone.

There is no exemption list. A model the API does not return is not a ZeroGPU model, and the docs stop describing it.

## API payload reference

| Field | Use in docs |
| --- | --- |
| `modelId` | The literal `model` value everywhere, and the `<code>` cell. Case-sensitive (`LFM2.5-1.2B-Instruct`, `glm-5.2`). |
| `taskDisplayName` | Picks the task page and the catalog **Task** column via the mapping below — not verbatim. |
| `maxTokens` | **Max tokens** column, context-window pill, and every context claim in prose. |
| `pricing.input_per_1m_tokens` / `output_per_1m_tokens` | Price columns and pills, formatted `$0.02`, `$1.10`, `$0.006`. |
| `pricing.cached_input_per_1m_tokens` | **Cached input /1M** column and pill, when positive — see the note below the table. |
| `pricing.favicon_url` | `src` of the 22×22 table icon and the 32×32 card icon. |
| `pricing.description` | Raw marketing copy. The source for a **new** blurb, rewritten in the repo's voice — never grounds for rewording an existing blurb. |
| `pricing.model_doc_url`, `terms_url`, `privacy_service` | The `**References:**` line. When `model_doc_url` points back at `docs.zerogpu.ai`, link the upstream model card from `terms_url`'s host instead; when there is no upstream page, omit the `[Model docs]` link and keep the other two. |
| `pricing.sample_responses_body` / `sample_chat_completions_body` | Request bodies for the task page and the playground. A null sample means the dashboard stores none for that surface — **not** that the endpoint is unsupported (see [Endpoint support](#endpoint-support)). |
| `modelUsecases` | Present on the GLiNER models: `usecase` → `{url, description, usecase_display_name, sample_*_body}`. Each key becomes a `###` sub-section on `docs/pii.mdx`. |
| `parameters`, `modelVersion`, `quantized`/`quantization` | Facts for the prose ("205M parameters", "served as an FP8 build"). |
| `displayPriority` | The dashboard's descending order — where to insert a new row, nothing more. |

**Cached input pricing is in the payload**, as `pricing.cached_input_per_1m_tokens`, and it is checked like any other price — but only a **positive** value is a rate. `0` is how the dashboard encodes "cache pricing does not apply here" (every classifier, embedding, and moderation model reports it) and `null` means it stores nothing; both are documented as `—` in the **Cached input /1M** column, with no pill, and neither disagrees with an existing `—`. A positive value must appear in the column and in the card pill on every page carrying one. Never write `$0.00` into the column — that asserts free cached input, which the payload does not say.

**Embedding dimensions are still not in the payload.** Leave them untouched.

### Task mapping

| `taskDisplayName` | Catalog **Task** column | Task page |
| --- | --- | --- |
| `Text Generation` | Text Generation | `docs/text-generation.mdx` |
| `Summarization` | Text Generation | `docs/text-generation.mdx` |
| `Text Classification` | Text Classification | `docs/text-classification.mdx` |
| `Text Moderation` | Text Moderation | `docs/moderation.mdx` |
| `PII` | Data Extraction | `docs/pii.mdx` |
| `Text Embedding` | Text Embedding | `docs/embeddings.mdx` |

### Slug rules

| Target | Rule | Example |
| --- | --- | --- |
| `api-reference/models/<slug>.mdx`, and every `/api-reference/models/…` link | lowercase, `.` → `-` | `glm-5.2` → `glm-5-2`, `LFM2.5-1.2B-Instruct` → `lfm2-5-1-2b-instruct` |
| `api-reference/openapi/playgrounds/<slug>.openapi.json` | case preserved, `.` → `_` | `glm-5.2` → `glm-5_2`, `LFM2.5-1.2B-Instruct` → `LFM2_5-1_2B-Instruct` |

## Never invent

API-sourced facts only: id, task, `maxTokens`, input/output price, favicon, parameter count, licence/terms/privacy links, sample bodies. Benchmark numbers, latency claims, provider comparisons, architecture details, and language counts may be carried over from an existing blurb or taken from the linked upstream model card — never generated. Draft a new blurb from `pricing.description` alone: state what the API states, omit what it does not, and list the omissions in the summary. Never fabricate a benchmark figure, a `zerogpu.ai/benchmarks/…` URL, or a response example absent from the payload.

## 4. Verify

Verification gates the PR: nothing is pushed until all of it passes.

```bash
python3 .claude/skills/model-sync/scripts/audit-models.py --strict   # expect: only NOTE lines
python3 -c "import json;json.load(open('docs.json'))"                # and every OpenAPI file touched
grep -rno 'api-reference/models/[a-z0-9.-]*' docs.json docs/*.mdx | sort -u   # each must exist as a file
```

Also confirm every `N models:` count matches the ids beside it, and that no `docs.json` nav entry or `<Card href>` points at a page you deleted.

If a check fails, fix the cause and re-run it. If it still fails, commit nothing, open no PR, and report the failure with the command output — a broken docs build is worse than a stale number.

## 5. Branch and open the PR

Once verification passes, ship it. No questions, no waiting.

**Nothing changed?** If the audit was already clean and no file was modified, create no branch and no PR. Report "already in sync" and stop.

```bash
# 1. a fresh branch cut from up-to-date main — never commit on main
git fetch origin
BRANCH="model-sync/$(date -u +%Y-%m-%d-%H%M)"
git switch --create "$BRANCH" origin/main
```

Cutting from `origin/main` makes the branch unique per run and independent of whatever was checked out. If edits were made on another branch, carry them over (`git stash` before the switch, `git stash pop` after) and re-run the [verify](#4-verify) commands.

```bash
# 2. stage only what the sync touched — never `git add -A`
git add docs/model-catalog.mdx docs/<task-pages-touched>.mdx api-reference/models/... \
        api-reference/openapi/... docs.json integrations/... cookbook/...
git status --short          # confirm nothing unrelated is staged
```

A repo that was dirty before the run stays dirty: unrelated work is not the sync's to commit. Deleted pages are staged the same way — `git rm <path>`, or `git add` on the deleted path — so the removal lands in the commit rather than being left behind.

```bash
# 3. commit
git commit -m "$(cat <<'EOF'
docs: sync model catalog with dashboard API

<one line per change, e.g.:>
- glm-5.2: max tokens 1,048,576 -> 262,144 (catalog, text-generation, open-weight, model page)
- zlm-v1-moderation-edge: max tokens 4,000 -> 800
- add <model>: catalog row + card, task page section, model page, playground, enum, nav
- remove <model>: deleted page and playground, dropped from enums and nav, redirect added

Source: https://api-dashboard.zerogpu.ai/api/models

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"

# 4. push and open the PR against main
git push -u origin "$BRANCH"
gh pr create --base main --head "$BRANCH" \
  --title "docs: sync model catalog with dashboard API" \
  --body "$(cat <<'EOF'
Automated model-catalog sync. The dashboard API is the source of truth; every value below was taken from it.

## Corrected
| Model | Field | Was | Now |
| --- | --- | --- | --- |

## Added
## Removed
<model — page and playground deleted, dropped from enums and nav, redirect added>

## Verification
- `audit-models.py --strict` — clean apart from NOTE lines
- `docs.json` and every edited OpenAPI file parse
- every `/api-reference/models/<slug>` link resolves to a file

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Rules for this step:

- **Never** commit to `main`, force-push, merge the PR, or delete a branch. Opening it is the whole job; review is someone else's.
- Fill both templates with the run's actual changes. An empty section is deleted, not left as a heading.
- Each run gets its own timestamped branch. Check for an earlier sync PR still open, and if there is one, say "supersedes #N" in the new PR's body and leave the old one alone:
  ```bash
  gh pr list --state open --json number,headRefName \
    --jq '.[] | select(.headRefName | startswith("model-sync/")) | "#\(.number) \(.headRefName)"'
  ```
- If the push or `gh pr create` fails — no auth, no network, protected branch — the commit still stands on the branch. Report the exact error and the branch name so it can be pushed later. Do not retry in a loop, and do not fall back to committing on `main`.

## 6. Report

One pass, no questions: values corrected, prose rewritten, models added, models removed with their redirects, pages created or deleted, `NOTE` lines and how each was resolved, any blurb claim that could not be sourced, and the PR URL (or the branch name and the exact error if the PR could not be opened).
