# Data extraction tutorial assets

Example data and scripts for the [Resume & profile extraction tutorial](https://docs.zerogpu.ai/cookbook/data-extraction-tutorial) on ZeroGPU docs.

Learn how to turn plain text (resumes, LinkedIn-style profile exports, job posts) into structured JSON using `gliner2-base-v1`. This folder is **text-only**: it does not cover OCR, PDF parsing, or images.

## What is in this folder

| Path | Description |
| --- | --- |
| [`dataset/`](dataset/) | Synthetic sample text (JSONL). Fictional people and companies only. |
| [`schemas/`](schemas/) | Example GLiNER `json` schemas for resumes and profiles |
| [`scripts/run_batch_extraction.py`](scripts/run_batch_extraction.py) | Run extraction over the dataset with your API credentials |
| [`blog-post.md`](blog-post.md) | Long-form article you can republish or adapt |

The step-by-step guide lives in the docs site: [cookbook/data-extraction-tutorial](https://docs.zerogpu.ai/cookbook/data-extraction-tutorial). API reference examples: [cookbook/data-extraction](https://docs.zerogpu.ai/cookbook/data-extraction).

## Quick start

1. Create a project and API key in the [ZeroGPU dashboard](https://zerogpu.ai).
2. From this directory:

```bash
cd scripts
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
export ZEROGPU_API_KEY="zgpu-your-key"
export ZEROGPU_PROJECT_ID="your-project-uuid"
```

3. Run extraction on sample resumes or profiles:

```bash
.venv/bin/python run_batch_extraction.py --dataset resumes --limit 3
.venv/bin/python run_batch_extraction.py --dataset profiles --limit 3
.venv/bin/python run_batch_extraction.py --dataset job_posts
```

Results are written to `outputs/` (not committed to git). Each line in the output JSONL is one record with an `extracted` field.

## Response shape

For `json` use cases, parsed output is usually nested:

```json
{
  "data": {
    "candidate": [
      {
        "full_name": "...",
        "email": "..."
      }
    ]
  }
}
```

Access the first row with `parsed["data"]["candidate"][0]` (or `profile` instead of `candidate`). For `ner`, see `extracted.entities` in the batch script output.

## Supported workflows

- Resumes and CVs pasted as plain text
- Profile text from exports or scrapers (you supply compliant text)
- Job posts tagged with custom entity labels (`ner`)

Not supported in this tutorial:

- OCR or scanned documents
- PDF or image ingestion (convert to text in your own pipeline first)

## License

Synthetic dataset and schemas are provided for learning and testing with ZeroGPU. See the main [docs repository](https://github.com/zerogpu/docs) for license terms.
