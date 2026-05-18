# Example dataset: text extraction tutorial

Synthetic, fictional text only. Safe to share publicly. No real people or companies.

## Files

| File | Records | Use case |
| --- | --- | --- |
| `resumes.jsonl` | 6 | Parse plain-text resumes into a `candidate` schema |
| `profiles.jsonl` | 6 | Parse LinkedIn-style scraped profile text into a `profile` schema |
| `job_posts.jsonl` | 4 | NER over job posts (`skills`, `tools`, `certification` labels) |

## JSONL format

Each line is one JSON object:

```json
{
  "id": "resume-001",
  "source": "synthetic",
  "text": "..."
}
```

## Schemas

Pair each file with the schema in [`../schemas/`](../schemas/):

- `resumes.jsonl` → `resume.json` (`metadata.usecase`: `json`)
- `profiles.jsonl` → `linkedin-profile.json` (`metadata.usecase`: `json`)
- `job_posts.jsonl` → use `ner` with labels in the tutorial script

## License

Released with ZeroGPU docs for tutorial and demo use. Do not use as training data without your own review.
