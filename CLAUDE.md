# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Mintlify-based source for the public ZeroGPU docs at https://docs.zerogpu.ai. Content is `.mdx`; navigation and theme are in `docs.json`. There is no app build step. Mintlify renders the files directly.

## Common commands

```bash
mint dev                                 # local preview at http://localhost:3000 (install once: npm i -g mint)
mint validate                            # validate docs.json + OpenAPI specs

node scripts/generate-openapi.mjs        # rebuild zerogpu.openapi.json + openapi/playgrounds/*.openapi.json from live catalog
node scripts/generate-model-pages.mjs    # regenerate models/*.mdx from catalog metadata + playgrounds manifest
node scripts/import-orchestration-batch-docs.mjs   # pulls Batch/Files prose from ../orchestration-api/docs/batch

node scripts/normalize-dashes.mjs        # enforce ASCII hyphens (no em/en dashes)
```

All scripts must be run from the repo root (`docs/`); several resolve paths against `process.cwd()`.

## Architecture

**Three sources of truth, glued by scripts:**

1. **Live model catalog** at `https://api-dashboard.zerogpu.ai/api/models`, the canonical list of models, pricing, schemas. There is no offline fallback: the build scripts and the runtime `model-catalog-bootstrap.js` fetch this endpoint directly and surface an error if it is unreachable.
2. **Hand-maintained `openapi/batch.openapi.json`**, covers all `/v1/files` and `/v1/batches` paths. Not regenerated; edit directly.
3. **External `orchestration-api/docs/batch/`** prose, imported into `api-reference/batch/*.mdx` by the import script, which also injects playground cards into `files-api.mdx` / `batches-api.mdx`.

**Generated vs hand-written:**
- Generated (do not hand-edit; rerun the script): `openapi/zerogpu.openapi.json`, `openapi/playgrounds/*.openapi.json`, `snippets/model-playgrounds.json`, `models/<model-id>.mdx` (the per-model pages, but `models/ad-tech.mdx`, `text-classification.mdx`, `text-generation.mdx`, `pii.mdx`, `summarization.mdx` are hand-written category pages), `api-reference/batch/{index,getting-started,files-api,batches-api,jsonl-format,supported-endpoints,examples,errors}.mdx`.
- Hand-written: every other `.mdx`, all `concepts/`, `platform/`, `cookbook/`, `sdks/`, `tutorials/`, plus the per-endpoint Batch playground pages (`upload-file.mdx`, `create-batch.mdx`, etc.) which wrap the hand-maintained `batch.openapi.json`.

**Adding/removing a model:** It will flow through automatically on the next catalog fetch, rerun `generate-openapi.mjs` then `generate-model-pages.mjs`, then add the new `models/<slug>` entry to the **By model** group in `docs.json` (the generator does not edit that nav list).

**Runtime JS (`*.js` at repo root):** Mintlify auto-loads every `.js` file in the repo globally as a `<script>` on all pages, there is no MDX-level `<script>` include. Currently:
- `model-catalog-bootstrap.js`, fetches the live catalog client-side and hydrates the catalog table on `platform/model-catalog`.
- `playground-model-lock.js`, locks the `model` field on per-model playgrounds and converts Responses `input` into a textarea. Loads `style.css` for related tweaks.

## Conventions

- **ASCII hyphens only.** No em (`-`) or en (`-`) dashes anywhere in prose. Run `normalize-dashes.mjs` after editing, it deliberately does *not* replace dashes with colons; it flags them.
- API base shown in playgrounds is set in `docs.json` (`api.mdx.server` = `https://api.zerogpu.ai/v1`).
- The `By model` group in `docs.json` must be updated by hand when adding a model page.
