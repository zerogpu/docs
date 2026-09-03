---
name: investor-outreach
description: Research, rank and draft investor outreach using ZeroGPU
version: 1.0.0
metadata:
  hermes:
    tags: [fundraising, outreach, zerogpu]
    category: growth
---

## When to Use
Fundraising outreach: find 5 investors who moved in the LAST 30 DAYS, score them,
and create one personalized Gmail draft each - to a verified address where one
exists, otherwise to the `Contact email` in company.md for review.
Run on demand. Never sends. No scheduling.

## Tool names
Hermes exposes MCP tools as `mcp__<server>__<tool>`, and this server's tools are
themselves named `zerogpu_*`. With the server added as `zerogpu`, the full name is
therefore `mcp__zerogpu__zerogpu_summarize` - the prefix repeats. Run
`hermes mcp list` once and use whatever names it prints. Below they are written
unprefixed for readability.

## Procedure

1. Read `/data/workspace/outreach/company.md`. Stop if missing.
2. **Discover, recency-first** - Dappier real-time search, one query per sector
   tag, scoped tight: "<tag> <stage> investors who led or announced a round in the
   last 30 days". Recency is a HARD filter, not a preference: an investor with no
   verifiable activity in the last 30 days is dropped, however good the thesis fit.
   The whole point is that the hook says "you just did X", not "you invest in Y".
3. **Structure** - for each result blob call `zerogpu_extract_json` with
   schema: {"investor": ["name::str::Partner full name",
                         "firm::str::Fund name",
                         "email::str::Contact email if present",
                         "thesis::str::What they invest in",
                         "recent::str::Most recent deal or quote",
                         "source::str::Article URL"]}
4. **Entities** - `zerogpu_extract_entities` with
   labels: ["person","organization","funding round","location"]
   to catch rows step 3 missed.
5. **Scrub** - `zerogpu_redact_pii` with mask "label" over every scraped blob
   BEFORE it is written to disk or quoted in an email. Keep the extracted `email`
   field from step 3 outside this pass - redacting it would destroy the address.
6. **Rank** - `zerogpu_embed` with model "bge-small-en-v1.5" on the company
   one-liner and on each investor `thesis`. Cosine-rank. Keep the top 5.
7. **Bucket** - `zerogpu_classify_structured` with
   schema: {"stage": ["pre-seed","seed","series-a","growth"],
            "geo_fit": ["yes","no"],
            "warmth": ["cold","warm","portfolio-adjacent"]}
   Drop stage mismatches and anything in Anti-targets.
8. **Resolve the address** - every investor gets a draft; only the recipient
   changes. Two paths:
   a. **Verified address found.** If discovery surfaced a real address for this
      partner (from the `email` field in step 3, or a source page that publishes
      it), use it. Record the source URL it came from.
   b. **No verified address.** Address the draft to the `Contact email` in
      `company.md`, prefix the subject with `[UNADDRESSED - <Partner>, <Firm>]` so
      it can never be mistaken for a ready-to-send email, and open the body with a
      line naming the intended recipient and why no address was found.
   **NEVER** construct an address from a pattern like first@firm.com, and never put
   a guessed address in the To field - that is what gets a sending domain
   blacklisted. If `company.md` has no `Contact email`, stop and ask for one; do
   not invent a placeholder recipient.
   Record which path each investor took - this goes in the report.
9. **Hook** - `zerogpu_summarize` on each `recent` blob, max_tokens 60, one
   sentence out. It must name the specific recent event and its date. That sentence
   is the only personalized line in the email.
10. **Draft** - `zerogpu_chat` with model "deepseek-v4-flash", max_tokens 400.
    Subject <= 60 chars. Body <= 120 words. Structure: hook / what we do /
    traction / the ask / one-line close. No superlatives. Never open with
    "I hope this finds you well."
11. **Gate** - `zerogpu_moderate` on subject+body. If `any_flagged` is true,
    discard the draft, log it, and do NOT call Zapier.
12. **Draft it** - the Zapier Gmail create-draft tool. NEVER a send tool. If the
    only Gmail tool available can send, stop and report instead.
13. **Report** - write three files under
    `/data/workspace/outreach/run-<YYYY-MM-DD>/`:
    - `review.md` - one row per investor with score, bucket, hook, subject, body,
      moderation verdict, source URL, the date of the recent event, the recipient
      address, and whether it was `verified` or `unaddressed`. List investors
      dropped for staleness too.
    - `drafts.md` - the full drafted emails, as handed to the Gmail draft tool.
    - `savings.md` - the ZeroGPU vs frontier-model cost report. See below; this
      file is REQUIRED.

## Usage and savings reporting

Every ZeroGPU tool result carries a `usage` block and a `savings` block. **`savings`
is the whole point of this workflow**: `baseline_cost_usd` is what the exact same
tokens would have cost on a frontier model, priced at $3.00 per 1M input and $15.00
per 1M output. It is a published frontier rate, never a ZeroGPU one - so
`savings_usd` is a like-for-like frontier comparison, not a marketing estimate.

Collect these as you go. Do not reconstruct them at the end.

**After each ZeroGPU tool call**, append one line to a running tally holding:
step number, tool name, `model`, `usage.input_tokens`, `usage.output_tokens`,
`savings.zerogpu_cost_usd`, `savings.baseline_cost_usd`, `savings.savings_usd`.

### `savings.md` - required, and it leads with the frontier comparison

1. **Headline, first line of the file**, in this shape:
   `This run cost $X on ZeroGPU. The same work on a frontier model would have cost
   $Y - N times cheaper, Z% saved, across C calls.`
   Compute N as `baseline_total / zerogpu_total` and Z as
   `savings_total / baseline_total * 100`.
2. The baseline basis, stated plainly: frontier reference rate of $3.00/1M input
   and $15.00/1M output, and the `savings.price_table_version` value. A savings
   figure without its price-table version is not quotable.
3. The per-call table, one row per ZeroGPU call, with a per-model subtotal so it is
   visible which small models did the heavy lifting.
4. Totals: summed `zerogpu_cost_usd`, summed `baseline_cost_usd`, summed
   `savings_usd`, total call count, total input and output tokens.
5. **Cost per drafted investor**, and the extrapolation that makes the number mean
   something: cost for 1,000 and 10,000 investors on ZeroGPU versus the frontier
   baseline.
6. **Model attribution.** For every generative call, record which model actually
   served it. If a fallback provider answered instead of the ZeroGPU model, say so
   explicitly and exclude those calls from the ZeroGPU totals. A savings number
   that silently includes fallback traffic is wrong.

If any section cannot be produced, write `savings.md` anyway stating what is
missing and why. Never omit the file, and never estimate a figure no tool returned.

## Final response

End the run by printing, in this order:

1. **Run summary of drafts** - a table with one row per investor:
   firm, partner, subject line, the recent event and its date, moderation verdict,
   recipient, and whether the recipient was `verified` or `unaddressed`. Then the
   counts: drafts created, split by recipient type, flagged, and dropped as stale.
2. **The frontier savings headline** from `savings.md`, verbatim - ZeroGPU cost,
   frontier-baseline cost, multiple, percent saved, call count.
3. **Cost per investor and the 10,000-investor extrapolation.**
4. Paths to `review.md`, `drafts.md` and `savings.md`.
5. Anything that failed, retried, or was skipped.

The savings headline is not optional and is not a footnote. It is the reason the
workflow runs on ZeroGPU, so it goes in the response every time - including on a
partial or failed run, where it should report what was spent before the failure.

## Pitfalls
- Write ONLY under /data/workspace/outreach. Anything outside /data is lost on
  container restart.
- ZeroGPU MCP failures return `isError: true` inside a normal-looking result, not
  an HTTP error. Check the payload before trusting a step.
- `zerogpu_embed`'s `model` is a strict enum, case-sensitive: "bge-small-en-v1.5"
  or "all-minilm-l6-v2". "BGE-Small-EN-v1.5" is rejected at schema validation.
- `zerogpu_embed` caps input at 512 tokens for bge-small-en-v1.5. Embed the
  `thesis` field, not a whole article.
- Do not pass `compact` to `zerogpu_summarize` on long blobs - it routes to
  t5-small, which reads only the first 512 tokens.
- `zerogpu_moderate` returns no `savings` block. Count it in the call count but
  skip it in the cost totals, and note the omission in `savings.md`.
- `zerogpu_extract_json` values are "field::type::desc" strings, not JSON types.
- If the draft model returns prose around the JSON, re-prompt rather than
  regex-parsing it.
- Fewer than 5 investors is a correct outcome only when discovery found fewer than
  5 with activity in the last 30 days. A missing email address is NEVER a reason to
  drop an investor - self-address the draft instead.
- A missing `Contact email` in `company.md` is the one addressing problem that
  stops the run. Ask for it; never substitute an invented address.
- `zerogpu_moderate` has returned transient 502s. Retry it; never skip the gate.
- Do not sum savings from memory at the end of a long run - the tally is appended
  per call for exactly this reason. A reconstructed total is a guessed total.

## Verification
All of the following must hold, or the run is incomplete:
- `review.md` exists with 5 rows or fewer; every row carries a moderation verdict
  and a recent-event date inside the last 30 days.
- `drafts.md` exists and has one email per row in `review.md`.
- `savings.md` exists, opens with the frontier-comparison headline, and contains
  all six sections including the per-call table, the `price_table_version`, the
  extrapolation and model attribution.
- The final response states the frontier savings headline explicitly.
- The call count in `savings.md` matches the number of ZeroGPU calls actually made.
- Gmail Drafts count equals `review.md` row count minus flagged rows - no row is
  ever dropped for a missing address.
- Every unaddressed draft carries the `[UNADDRESSED - ...]` subject prefix.
- Sent-mail count for the run is zero.

Cross-check the totals against `hermes insights` before quoting any figure
externally - the tally in `savings.md` is self-reported.
