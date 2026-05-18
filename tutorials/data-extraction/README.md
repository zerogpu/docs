# Data extraction tutorial — launch package

Marketing and education assets for the [Data extraction cookbook](/cookbook/data-extraction) recipe. **Text-only** workflows (résumés, LinkedIn-style profile text). No OCR.

## Contents

| Asset | File | Purpose |
| --- | --- | --- |
| In-docs tutorial | [`../../cookbook/data-extraction-tutorial.mdx`](../../cookbook/data-extraction-tutorial.mdx) | Step-by-step walkthrough on docs.zerogpu.ai |
| Blog post | [`blog-post.md`](blog-post.md) | Long-form publish (website, Dev.to, etc.) |
| Example dataset | [`dataset/`](dataset/) | Synthetic résumés and profile snippets |
| Schemas | [`schemas/`](schemas/) | GLiNER `json` use-case schemas |
| Batch demo | [`scripts/run_batch_extraction.py`](scripts/run_batch_extraction.py) | Run extraction over the dataset |

## Production checklist

- [ ] Record video walkthrough (dashboard + terminal; follow the in-docs tutorial)
- [ ] Publish blog from [`blog-post.md`](blog-post.md); link to https://docs.zerogpu.ai/cookbook/data-extraction
- [ ] Post on social with links to the tutorial and dataset
- [ ] Optional: add `demos/data-extraction-python` to [zerogpu/cookbook](https://github.com/zerogpu/cookbook) repo

## Run the dataset locally

```bash
cd docs/tutorials/data-extraction/scripts
export ZEROGPU_API_KEY="zgpu-..."
export ZEROGPU_PROJECT_ID="your-project-uuid"
pip install requests
python run_batch_extraction.py --dataset resumes --limit 3
python run_batch_extraction.py --dataset profiles --limit 3
```

Outputs land in `outputs/` (gitignored via local `.gitignore` if you add one).

## Scope (per product review)

- **In scope:** Unstructured **text** → structured JSON (résumés, scraped profile bios, skills NER).
- **Out of scope for v1:** OCR, PDF parsing, image/screenshot ingestion.
