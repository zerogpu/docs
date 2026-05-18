# Turn resumes and LinkedIn text into structured JSON with ZeroGPU

*Tutorial companion to the [Data extraction cookbook](https://docs.zerogpu.ai/cookbook/data-extraction). Text in, JSON out. No OCR required.*

---

Most teams do not need a giant model to structure text. They need a reliable way to pull **names, roles, skills, and contact fields** out of documents that already exist as plain text: resumes pasted into an ATS, profile pages saved from a scraper, or exports from a recruiting workflow.

ZeroGPU's extraction models are built for exactly that. You send unstructured text to one API endpoint; you get structured JSON back. This post walks through two real-world patterns (**resume parsing** and **LinkedIn-style profile extraction**) and points you at a free example dataset you can run today.

## What we are (and are not) covering

**In scope for this tutorial**

- Plain-text resumes and profile snippets
- Schema-driven field extraction (`json` use case)
- Skill and tool tagging with named-entity labels (`ner` use case)
- Optional PII detection on user-submitted text

**Explicitly out of scope**

- OCR, PDF rendering, or screenshot parsing
- Image-based document ingestion

If your pipeline already produces text (from copy-paste, HTML-to-text, or a compliant scraper), you are ready.

## Why schema-driven extraction beats regex

Regex and hand-tuned parsers break the moment formatting changes. A new section order, an extra bullet, or a multilingual header and your pipeline needs another patch.

GLiNER-style extraction on ZeroGPU flips the contract: you declare **what** you want (field names, types, short descriptions) in a `schema`, and the model fills it from context. That maps cleanly to downstream systems (CRMs, ATS imports, search indexes) without maintaining dozens of brittle patterns.

## Use case 1: Resume to candidate record

**Model:** `gliner2-base-v1`  
**Use case:** `metadata.usecase = "json"`

Define a `candidate` object with fields like name, email, current title, and skills. Paste a resume as a single string `input` (GLiNER models accept plain text).

Example schema (abbreviated):

```json
{
  "candidate": [
    "full_name::str::Candidate full name",
    "email::str::Email address",
    "current_title::str::Most recent job title",
    "current_company::str::Most recent employer",
    "skills::str::Comma-separated key skills mentioned"
  ]
}
```

**Request shape:**

```bash
curl --location 'https://api.zerogpu.ai/v1/responses' \
  --header 'content-type: application/json' \
  --header 'x-api-key: YOUR_API_KEY' \
  --header 'x-project-id: YOUR_PROJECT_ID' \
  --data '{
    "model": "gliner2-base-v1",
    "input": "ALEX RIVERA\nSan Francisco, CA | alex.rivera@example-mail.io ...",
    "metadata": {
      "usecase": "json",
      "schema": { "candidate": ["full_name::str::...", "email::str::..."] }
    }
  }'
```

Parse `output[0].content[0].text` as JSON. The payload is typically nested under `data.candidate` as a list of objects. That row is your normalized candidate record.

**Tip:** Start with 6-8 high-value fields. Add more only after you validate precision on a small golden set.

## Use case 2: LinkedIn-style profile text to profile object

Scrapers and browser extensions usually give you messy text: headline fragments, About blurbs, duplicated employer lines. The same `json` use case works with a **profile** schema tuned to social layouts.

```json
{
  "profile": [
    "name::str::Person name",
    "headline::str::Professional headline",
    "current_role::str::Current job title",
    "current_company::str::Current company",
    "location::str::Profile location"
  ]
}
```

Pair this with our [synthetic profile dataset](https://github.com/zerogpu/docs/tree/main/tutorials/data-extraction/dataset) (fictional data only) to regression-test schema changes before you touch production traffic.

## Use case 3: Skills NER on job posts

When you do not have a fixed field list, only categories like "programming language" or "cloud platform", switch to **`ner`** with a `labels` array on the same model. This is useful for tagging job descriptions before search or matching.

```json
"metadata": {
  "usecase": "ner",
  "labels": ["programming language", "database", "cloud platform", "certification"],
  "threshold": 0.3
}
```

## Privacy: detect PII before you store text

For inbound user content, run **`gliner-multi-pii-v1`** with `extract-pii` (or `redact` if you need masked text). Categories like `identity` and `contact` keep compliance review focused on spans, not guesswork.

See the [cookbook PII section](https://docs.zerogpu.ai/cookbook/data-extraction#pii-extraction) for request examples.

## Run the example dataset in minutes

We shipped a tutorial bundle in the [ZeroGPU docs repo](https://github.com/zerogpu/docs/tree/main/tutorials/data-extraction):

- `dataset/resumes.jsonl` (six synthetic resumes)
- `dataset/profiles.jsonl` (six synthetic profile snippets)
- `dataset/job_posts.jsonl` (four posts for NER demos)
- `scripts/run_batch_extraction.py` (batch runner with env-based credentials)

```bash
export ZEROGPU_API_KEY="zgpu-..."
export ZEROGPU_PROJECT_ID="your-project-uuid"
cd tutorials/data-extraction/scripts
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python run_batch_extraction.py --dataset resumes --limit 3
```

Outputs are written to `outputs/` for spot-checking JSON quality.

## How this fits your stack

1. **Ingest text** (ATS paste, scraper export, CRM note). Keep it text-only for this tutorial.
2. **Call** `POST https://api.zerogpu.ai/v1/responses` with `metadata` for the right use case.
3. **Parse** the JSON string from the response envelope.
4. **Load** into your warehouse, search index, or matching service.

For high volume, use parallel requests and per-item error handling. See patterns in the [batch requests cookbook](https://docs.zerogpu.ai/cookbook/batch-requests).

## Next steps

- Follow the [step-by-step tutorial](https://docs.zerogpu.ai/cookbook/data-extraction-tutorial) on the docs site
- Read the full [Data extraction recipe](https://docs.zerogpu.ai/cookbook/data-extraction)
- Try the interactive playground on [gliner2-base-v1](https://docs.zerogpu.ai/models/gliner2-base-v1)
- Get API keys from the [ZeroGPU dashboard](https://zerogpu.ai)

Questions or schema examples you want published? Reach us on [Discord](https://discord.gg/zerogpu) or X [@zerogpu](https://x.com/zerogpu).

---

**Suggested meta (for CMS)**

- Title: Turn resumes and LinkedIn text into structured JSON with ZeroGPU
- Description: Text-only extraction tutorial: resume parsing, profile scrapers, and a free synthetic dataset. No OCR.
- Tags: information extraction, GLiNER, API, recruiting tech, structured data
