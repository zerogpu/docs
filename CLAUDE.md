# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Mintlify-based source for the public ZeroGPU docs at https://docs.zerogpu.ai. Content is `.mdx`; navigation and theme are in `docs.json`. There is no app build step. Mintlify renders the files directly.

## Common commands

```bash
mint dev                                 # local preview at http://localhost:3000 (install once: npm i -g mint)
mint validate                            # validate docs.json + OpenAPI specs
```

There is no codegen step. Every file is committed and edited by hand. (The previous `scripts/` generators were removed and are being rebuilt from scratch.)

## Architecture

Everything is static, committed `.mdx` plus a few committed OpenAPI/JSON files. There is no codegen and no build step beyond what Mintlify does to render the files. The upstream model catalog (`https://api-dashboard.zerogpu.ai/api/models`) is still the canonical source for model IDs, pricing, and schemas, but nothing in this repo fetches it any more, the relevant pages and specs were generated once and are now maintained by hand.

**Key committed files (all hand-maintained now):**
- `openapi/zerogpu.openapi.json`, `openapi/playgrounds/*.openapi.json`, the per-model `models/<model-id>.mdx` pages, and `api-reference/batch/*.mdx`. These were originally produced by the now-removed `scripts/` generators; edit them directly until the regeneration pipeline is rebuilt.
- `openapi/batch.openapi.json` covers all `/v1/files` and `/v1/batches` paths, edit directly.
- The model category pages (`models/ad-tech.mdx`, `text-classification.mdx`, `text-generation.mdx`, `pii.mdx`, `summarization.mdx`) and every other `.mdx` under `concepts/`, `platform/`, `cookbook/`, `sdks/` are plain hand-written pages.

**Adding/removing a model:** fully manual now, edit the OpenAPI specs and `models/<slug>.mdx` page, then add/remove the `models/<slug>` entry in the **By model** group in `docs.json`.

## Conventions

- **ASCII hyphens only.** No em (`-`) or en (`-`) dashes anywhere in prose. Check this by hand when editing (the `normalize-dashes.mjs` helper was removed).
- API base shown in playgrounds is set in `docs.json` (`api.mdx.server` = `https://api.zerogpu.ai/v1`).
- The `By model` group in `docs.json` must be updated by hand when adding a model page.
