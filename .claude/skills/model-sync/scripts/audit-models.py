#!/usr/bin/env python3
"""Audit — and optionally repair — the ZeroGPU docs against the live model catalog API.

The API (https://api-dashboard.zerogpu.ai/api/models) is the source of truth for every
machine-readable fact about a model: pricing, maxTokens, task, parameters, favicon.

Reports, per model:
  * MISSING — a docs surface with no entry for the model
  * DRIFT   — a table cell that disagrees with the API (rewritten by --fix)
  * PROSE   — a pill, blurb, or sentence stating a stale number, with file:line
  * NOTE    — an unused favicon, an unmapped task, a stray curated-page mention
  * ORPHAN  — a documented model the API does not return, plus every file to clean

Default run is read-only. --fix rewrites drifting table cells in place; prose, pills,
and counts are located for the caller to edit, never machine-rewritten.

Usage:
  python3 .claude/skills/model-sync/scripts/audit-models.py
  python3 .claude/skills/model-sync/scripts/audit-models.py --fix
  python3 .claude/skills/model-sync/scripts/audit-models.py --model glm-5.2 --fix
  python3 .claude/skills/model-sync/scripts/audit-models.py --save models.json
  python3 .claude/skills/model-sync/scripts/audit-models.py --json models.json   # offline
  python3 .claude/skills/model-sync/scripts/audit-models.py --strict             # CI/loop
"""

import argparse
import json
import os
import re
import sys
import urllib.request

API_URL = "https://api-dashboard.zerogpu.ai/api/models"

# API taskDisplayName -> (task label used in the catalog table, task guide page)
TASK_MAP = {
    "Text Generation": ("Text Generation", "docs/text-generation.mdx"),
    "Summarization": ("Text Generation", "docs/text-generation.mdx"),
    "Text Classification": ("Text Classification", "docs/text-classification.mdx"),
    "Text Moderation": ("Text Moderation", "docs/moderation.mdx"),
    "PII": ("Data Extraction", "docs/pii.mdx"),
    "Text Embedding": ("Text Embedding", "docs/embeddings.mdx"),
}

# Curated pages: membership follows the rules in SKILL.md, and their tables carry the
# same numbers, kept in sync like any other page.
CURATED_PAGES = ["docs/open-weight.mdx", "docs/ad-tech.mdx"]

CATALOG = "docs/model-catalog.mdx"


# --------------------------------------------------------------------------- helpers


def repo_root():
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.abspath(os.path.join(here, "..", "..", "..", ".."))
    if not os.path.exists(os.path.join(root, "docs.json")):
        root = os.getcwd()
    return root


def page_slug(model_id):
    """api-reference/models/<slug>.mdx"""
    return model_id.lower().replace(".", "-")


def playground_slug(model_id):
    """api-reference/openapi/playgrounds/<slug>.openapi.json"""
    return model_id.replace(".", "_")


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "zerogpu-docs-audit"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


class Doc:
    """A text file, held as lines so table cells can be rewritten in place."""

    def __init__(self, root, rel):
        self.rel = rel
        self.path = os.path.join(root, rel)
        self.exists = os.path.exists(self.path)
        self.lines = []
        self.dirty = False
        if self.exists:
            with open(self.path, encoding="utf-8") as f:
                self.lines = f.read().splitlines()
        self.text = "\n".join(self.lines)
        self.rows = parse_tables(self.lines) if self.exists else {}

    def save(self):
        if self.dirty:
            with open(self.path, "w", encoding="utf-8") as f:
                f.write("\n".join(self.lines) + "\n")
            self.dirty = False


class Row(dict):
    """One markdown table row, keyed by column header, remembering where it lives."""

    def __init__(self, headers, cells, line):
        super().__init__(zip(headers, cells))
        self.headers = headers
        self.cells = cells
        self.line = line

    def index_of(self, prefix):
        for i, h in enumerate(self.headers):
            if h.lower().startswith(prefix.lower()):
                return i
        return None


def parse_tables(lines):
    """{model_id: Row} for every table row whose first cell holds <code>model-id</code>."""
    out = {}
    headers = None
    for n, line in enumerate(lines):
        s = line.strip()
        if not s.startswith("|"):
            headers = None
            continue
        cells = [c.strip() for c in s.strip("|").split("|")]
        if set("".join(cells)) <= set("-: "):  # separator row
            continue
        if headers is None:
            headers = cells
            continue
        m = re.search(r"<code>([^<]+)</code>", cells[0])
        if m:
            out[m.group(1)] = Row(headers, cells, n)
    return out


def money(cell):
    if cell is None:
        return None
    c = cell.strip()
    if c in ("—", "-", "", "Not billed", "n/a"):
        return None
    m = re.search(r"\$?\s*([\d.]+)", c)
    return float(m.group(1)) if m else None


def fmt_money(v):
    return f"${v:.2f}" if round(v, 2) == v else f"${v:g}"


def number(cell):
    if cell is None:
        return None
    m = re.search(r"([\d,]+)", cell)
    return int(m.group(1).replace(",", "")) if m else None


def col(row, *names):
    if row is None:
        return None
    for n in names:
        i = row.index_of(n)
        if i is not None:
            return row.cells[i]
    return None


def set_cell(doc, row, header_prefix, value):
    """Rewrite one cell of a table row in place. Returns False when the column is absent."""
    i = row.index_of(header_prefix)
    if i is None:
        return False
    row.cells[i] = value
    row[row.headers[i]] = value
    doc.lines[row.line] = "| " + " | ".join(row.cells) + " |"
    doc.dirty = True
    return True


def human_forms(n):
    """Ways a token count is legitimately written in prose:
    1048576 -> 1,048,576 / 1048576 / 1024K / 1M;  262144 -> 262,144 / 256K / 0.25M."""
    forms = {f"{n:,}", str(n)}
    if n % 1_048_576 == 0:
        forms.add(f"{n // 1_048_576}M")
    elif n >= 262_144 and (n / 1_048_576) in (0.25, 0.5, 0.75):
        forms.add(f"{n / 1_048_576:g}M")
    if n % 1024 == 0:
        forms.add(f"{n // 1024}K")
    if n % 1000 == 0:
        forms.add(f"{n // 1000}K")
    if n % 1_000_000 == 0:
        forms.add(f"{n // 1_000_000}M")
    return forms


def scope_lines(doc, mid):
    """Line numbers that belong to this model: its '## <id>' section, its <Card> block,
    and any line naming it. Keeps the prose scan from flagging a neighbour's numbers."""
    allowed = set()
    n = len(doc.lines)
    slug = page_slug(mid)
    for i, line in enumerate(doc.lines):
        s = line.strip()
        if re.match(r"^##\s+" + re.escape(mid) + r"\s*$", s):
            j = i + 1
            while j < n and not doc.lines[j].strip().startswith("## "):
                allowed.add(j)
                j += 1
        elif f'<Card href="/api-reference/models/{slug}"' in line:
            j = i
            while j < n and "</Card>" not in doc.lines[j]:
                allowed.add(j)
                j += 1
        if mid in line:
            allowed.add(i)
    return allowed


PILL_TOKENS = re.compile(r"([\d,]+)\s+(context window|max tokens)")
PILL_PRICE = re.compile(r"\\?\$([\d.]+)\s*/\s*1M\s+(input|output|cached input)")
PROSE_TOKENS = re.compile(r"\b([\d,]{4,}|\d+(?:\.\d+)?[KM])[-\s]token")


def tidy(line):
    return re.sub(r"style=\{\{[^}]*\}\}", "…", line.strip())[:120]


def check_prose(doc, mid, m):
    """Stale numbers in this model's card pills, blockquote, and prose — checked against
    the API on every run, independently of whether the table cells agree."""
    stale = []
    pricing = m.get("pricing") or {}
    max_tokens = m.get("maxTokens")
    prices = {
        "input": pricing.get("input_per_1m_tokens"),
        "output": pricing.get("output_per_1m_tokens"),
    }
    for n in sorted(scope_lines(doc, mid)):
        line = doc.lines[n]
        if line.strip().startswith("|"):  # table rows are handled by check_table
            continue
        where = f"{doc.rel}:{n + 1}"
        for raw, phrase in PILL_TOKENS.findall(line):
            val = int(raw.replace(",", ""))
            if max_tokens and val != max_tokens:
                stale.append(f"{where}: pill says '{raw} {phrase}' — API says {max_tokens:,}")
        for raw, kind in PILL_PRICE.findall(line):
            api = prices.get(kind)  # cached input is not in the API payload — skip it
            if api is not None and abs(float(raw) - api) > 1e-9:
                stale.append(
                    f"{where}: pill says '${raw} / 1M {kind}' — API says {fmt_money(api)}"
                )
        for raw in PROSE_TOKENS.findall(line):
            if max_tokens and raw not in human_forms(max_tokens):
                stale.append(
                    f"{where}: prose says '{raw}-token' — API maxTokens is {max_tokens:,} "
                    f"({'/'.join(sorted(human_forms(max_tokens)))}): {tidy(line)}"
                )
    return stale


def frontmatter_title(path):
    """The `title:` of an .mdx page — an orphan page's real model id."""
    try:
        with open(path, encoding="utf-8") as f:
            for line in f.read().splitlines()[:12]:
                m = re.match(r'^title:\s*"?([^"]+)"?\s*$', line)
                if m:
                    return m.group(1).strip()
    except OSError:
        pass
    return None


SEARCHABLE = (".mdx", ".md", ".json")
SKIP_DIRS = {".git", ".claude", "node_modules", ".youtube"}


def orphan_locations(root, mid, slug):
    """Every file that references a model, so its removal can be done exhaustively."""
    needles = [mid, f"models/{slug}", f"{playground_slug(mid)}.openapi.json"]
    hits = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in sorted(filenames):
            if not fn.endswith(SEARCHABLE):
                continue
            path = os.path.join(dirpath, fn)
            rel = os.path.relpath(path, root)
            try:
                with open(path, encoding="utf-8") as f:
                    body = f.read()
            except (OSError, UnicodeDecodeError):
                continue
            if not any(n in body for n in needles):
                continue
            count = sum(body.count(n) for n in needles)
            own_page = rel == f"api-reference/models/{slug}.mdx"
            own_playground = rel == (
                f"api-reference/openapi/playgrounds/{playground_slug(mid)}.openapi.json"
            )
            if own_page or own_playground:
                note = "  (delete the file)"
            elif rel == "docs.json":
                note = (
                    f"  (drop the nav entry AND add a redirect from "
                    f"/api-reference/models/{slug})"
                )
            elif rel.endswith("zerogpu.openapi.json"):
                note = "  (drop from the model enum)"
            else:
                note = "  (strip the rows, sections, and mentions)"
            hits.append(f"{rel} ({count} mention{'s' if count != 1 else ''}){note}")
    return hits


# ------------------------------------------------------------------- drift per table


def check_table(doc, row, m, task_label, apply_fix):
    """Compare one table row against the API. Returns (drift, fixed)."""
    drift, fixed = [], []
    pricing = m.get("pricing") or {}
    checks = [
        ("Input", money(col(row, "Input")), pricing.get("input_per_1m_tokens"), "money"),
        ("Output", money(col(row, "Output")), pricing.get("output_per_1m_tokens"), "money"),
        ("Max tokens", number(col(row, "Max tokens")), m.get("maxTokens"), "int"),
    ]
    if task_label and row.index_of("Task") is not None:
        checks.append(("Task", (col(row, "Task") or "").strip(), task_label, "text"))

    for header, doc_val, api_val, kind in checks:
        if doc_val is None or api_val is None:
            continue
        if kind == "money":
            same = abs(doc_val - api_val) < 1e-9
            shown, new = fmt_money(doc_val), fmt_money(api_val)
        elif kind == "int":
            same, shown, new = doc_val == api_val, f"{doc_val:,}", f"{api_val:,}"
        else:
            same, shown, new = doc_val == api_val, doc_val, api_val
        if same:
            continue
        drift.append(f"{doc.rel}: {header.lower()} {shown} in docs vs {new} in API")
        if apply_fix and set_cell(doc, row, header, new):
            fixed.append(f"{doc.rel}:{row.line + 1}: {header.lower()} {shown} -> {new}")
    return drift, fixed


# --------------------------------------------------------------------------- main


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", help="read the model list from this file instead of the API")
    ap.add_argument("--save", help="write the fetched payload here")
    ap.add_argument("--model", action="append", help="limit the report to these model ids")
    ap.add_argument("--fix", action="store_true", help="rewrite drifting table cells in place")
    ap.add_argument("--strict", action="store_true", help="exit 1 when anything is reported")
    args = ap.parse_args()

    root = repo_root()

    if args.json:
        with open(args.json, encoding="utf-8") as f:
            payload = json.load(f)
    else:
        payload = fetch(API_URL)
    if args.save:
        with open(args.save, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)

    models = payload.get("models") or []
    if not models:
        print("ERROR: the API returned no models — do not touch the docs.", file=sys.stderr)
        return 2

    api_ids = [m["modelId"] for m in models]
    selected = [m for m in models if not args.model or m["modelId"] in args.model]
    if args.model:
        unknown = set(args.model) - set(api_ids)
        for u in sorted(unknown):
            print(f"NOTE: '{u}' is not in the API response.")

    docs = {}

    def doc(rel):
        if rel not in docs:
            docs[rel] = Doc(root, rel)
        return docs[rel]

    catalog = doc(CATALOG)
    docs_json = doc("docs.json")
    try:
        spec = json.loads(doc("api-reference/openapi/zerogpu.openapi.json").text or "{}")
    except json.JSONDecodeError:
        spec = {}

    schemas = spec.get("components", {}).get("schemas", {})

    def model_prop(schema):
        return schemas.get(schema, {}).get("properties", {}).get("model", {})

    responses_enum = model_prop("CreateResponseRequest").get("enum", [])
    chat_enum = model_prop("CreateChatCompletionRequest").get("enum", [])
    embedding_enum = model_prop("CreateEmbeddingRequest").get("enum", [])
    moderation_prop = json.dumps(model_prop("CreateModerationRequest"))

    print(f"API: {len(models)} models — {', '.join(api_ids)}")
    print(f"mode: {'FIX (table cells rewritten in place)' if args.fix else 'report only'}\n")

    findings = 0
    all_fixed = []

    for m in selected:
        mid = m["modelId"]
        pricing = m.get("pricing") or {}
        task_api = m.get("taskDisplayName") or "?"
        task_label, task_page = TASK_MAP.get(task_api, (task_api, None))
        missing, drift, prose, notes, fixed = [], [], [], [], []

        # --- docs/model-catalog.mdx: table row, model card, task-library card ----
        row = catalog.rows.get(mid)
        if row is None:
            missing.append(f"{CATALOG}: no row in the At-a-glance table")
        else:
            d, f = check_table(catalog, row, m, task_label, args.fix)
            drift += d
            fixed += f
        prose += check_prose(catalog, mid, m)
        if f'href="/api-reference/models/{page_slug(mid)}"' not in catalog.text:
            missing.append(f"{CATALOG}: no detailed model card")
        library = catalog.text.split("## Model library by task")[-1]
        if f"`{mid}`" not in library:
            missing.append(f"{CATALOG}: not listed under 'Model library by task'")

        # --- the task page -------------------------------------------------------
        if task_page:
            tp = doc(task_page)
            if not tp.exists:
                notes.append(f"{task_page}: page does not exist yet for task '{task_api}'")
            elif mid not in tp.text:
                missing.append(f"{task_page}: no entry (table row + '## {mid}' section)")
            else:
                trow = tp.rows.get(mid)
                if trow is None:
                    missing.append(f"{task_page}: mentioned but missing from the pricing table")
                else:
                    d, f = check_table(tp, trow, m, None, args.fix)
                    drift += d
                    fixed += f
                prose += check_prose(tp, mid, m)
                if not re.search(r"^##\s+" + re.escape(mid) + r"\s*$", tp.text, re.M):
                    missing.append(
                        f"{task_page}: no '## {mid}' section with request/response examples"
                    )
        else:
            notes.append(f"unmapped taskDisplayName '{task_api}' — pick the task page by hand")

        # --- per-model reference page + playground -------------------------------
        model_page = f"api-reference/models/{page_slug(mid)}.mdx"
        mp = doc(model_page)
        if not mp.exists:
            missing.append(f"{model_page}: page does not exist")
        else:
            prose += check_prose(mp, mid, m)
        pg = f"api-reference/openapi/playgrounds/{playground_slug(mid)}.openapi.json"
        if not doc(pg).exists:
            missing.append(f"{pg}: playground spec does not exist")

        # --- docs.json nav -------------------------------------------------------
        if f'"api-reference/models/{page_slug(mid)}"' not in docs_json.text:
            missing.append("docs.json: not in the API Reference > 'By model' group")

        # --- shared openapi enums ------------------------------------------------
        # Moderation and embedding models are routable only on their own endpoint, so
        # they belong in that request schema, not in the Responses/Chat enums.
        if spec:
            oa = "api-reference/openapi/zerogpu.openapi.json"
            if task_api == "Text Moderation":
                if mid not in moderation_prop:
                    notes.append(f"{oa}: not referenced by CreateModerationRequest.model")
            elif task_api == "Text Embedding":
                if mid not in embedding_enum:
                    missing.append(f"{oa}: absent from the CreateEmbeddingRequest model enum")
            else:
                # The payload does not say which endpoints a model is routable on:
                # llama-3.1-8b-instruct-fast has sample_responses_body: null yet is fully
                # supported on /v1/responses. So a missing sample is not evidence of a
                # missing endpoint — only total absence from both enums is a real gap.
                if mid not in responses_enum and mid not in chat_enum:
                    missing.append(f"{oa}: absent from both the Responses and Chat model enums")

        # --- curated pages -------------------------------------------------------
        for page in CURATED_PAGES:
            cp = doc(page)
            if not cp.exists or mid not in cp.text:
                continue
            crow = cp.rows.get(mid)
            if crow is None:
                notes.append(f"{page}: mentioned but not in the table")
                continue
            d, f = check_table(cp, crow, m, None, args.fix)
            drift += d
            fixed += f
            prose += check_prose(cp, mid, m)

        fav = pricing.get("favicon_url")
        if fav and fav not in catalog.text:
            notes.append(f"favicon not used anywhere in the catalog: {fav}")

        prose = sorted(set(prose))
        if not (missing or drift or prose):
            status = "OK"
        elif args.fix and not (missing or prose):
            status = "FIXED"
        else:
            status = "NEEDS WORK"
        print(f"## {mid}  [{status}]")
        print(
            f"   task={task_api}  maxTokens={m.get('maxTokens')}  "
            f"in=${pricing.get('input_per_1m_tokens')}  out=${pricing.get('output_per_1m_tokens')}  "
            f"params={m.get('parameters')}"
        )
        for label, items in (
            ("MISSING", missing),
            ("DRIFT", drift),
            ("FIXED", fixed),
            ("PROSE", prose),
            ("NOTE", notes),
        ):
            for i in items:
                print(f"   {label}: {i}")
        findings += len(missing) + len(drift) + len(prose)
        all_fixed += fixed
        print()

    if args.fix:
        for d in docs.values():
            d.save()

    # --- documented but not in the API ----------------------------------------
    models_dir = os.path.join(root, "api-reference", "models")
    if os.path.isdir(models_dir) and not args.model:
        slugs = {page_slug(i) for i in api_ids}
        for fn in sorted(os.listdir(models_dir)):
            if not fn.endswith(".mdx") or fn[:-4] in slugs:
                continue
            slug = fn[:-4]
            mid = frontmatter_title(os.path.join(models_dir, fn)) or slug
            print(f"ORPHAN: {mid} is documented but the API does not return it — remove it.")
            for loc in orphan_locations(root, mid, slug):
                print(f"   REMOVE: {loc}")
            findings += 1

    print(f"\n{findings} finding(s){f'; {len(all_fixed)} cell(s) rewritten' if args.fix else ''}.")
    if args.fix:
        print(
            "Table cells are the only thing --fix rewrites. Card pills, blockquote prose, "
            "and 'N models:' counts must be edited by hand — see the PROSE lines above."
        )
    return 1 if (args.strict and findings) else 0


if __name__ == "__main__":
    sys.exit(main())
