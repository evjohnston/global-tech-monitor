"""CapIQ Transactions multi-field classification pipeline.

Reads one S&P Capital IQ Pro "Transactions" screener export per field,
tags each row by keyword tier + semantic (embedding) similarity, and
writes a per-field tagged workbook plus a combined cross-field dataset.

Usage:
    # single-field smoke test (prints shape + a few classified rows, no files written)
    python pipeline.py --field quantum --test

    # full run, one field
    python pipeline.py --field quantum

    # full run, every configured field
    python pipeline.py --all

Real, verified-by-hand quirks of these exports this code has to handle
(see CLAUDE.md's "VC funding tracking" section for the TypeScript
importer's version of several of these same lessons):
  - Header is on row index 2 (0-indexed) — rows 0-1 are blank.
  - The 3 rows immediately after the header are junk: SPTR_ mnemonic
    codes, then scattered sub-labels ("Include Estimated", "Announcement",
    "Investor 1"...), then a near-blank continuation row. Confirmed by
    hand against a real quantum export (2026-07-25) that dropping exactly
    3 rows after header=2 lands cleanly on real data.
  - Column headers contain embedded newlines and units, e.g.
    "Total Transaction Value\n($M)" — flattened to single-line, single-
    spaced text on load.
  - "Target/Issuer Name" appears twice (pandas will suffix the second as
    "Target/Issuer Name.1") — the duplicate is dropped, not renamed.
  - The date column is NOT consistently named across exports — confirmed
    by hand across multiple real files this session: some use "Announced
    Date", at least one real export uses "Completion Date" instead, and
    the very first quantum export pulled had no date column at all. This
    code checks a list of known aliases and logs which one (if any) it
    found per file, rather than assuming one name and crashing or
    silently producing empty dates.
"""
from __future__ import annotations

import argparse
import hashlib
import re
import sys
from dataclasses import dataclass, field as dc_field
from pathlib import Path

import numpy as np
import pandas as pd

from keywords import KEYWORDS_BY_FIELD, SEEDS_BY_FIELD

# ── Config ──────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parents[2]
CIQ_DATA_DIR = REPO_ROOT / "ciq_data"
OUTPUT_DIR = REPO_ROOT / "ciq_output"
EMBED_CACHE_DIR = REPO_ROOT / ".embed_cache"

# field key -> filename in ciq_data/. S&P-Conductors.xlsx (a keyword-search
# variant of semiconductors, confirmed NOT neuroscience — see CLAUDE.md-
# style note in the session history) was removed from ciq_data/ once
# S&P-Neuroscience.xlsx, the real file, was added — no longer configured.
FILES_BY_FIELD = {
    "quantum": "S&P-Quantum.xlsx",
    "ai": "S&P-ArtificialIntelligence.xlsx",
    "biotech": "S&P-Biotechandsyntheticbio.xlsx",
    "cryptography": "S&P-Cryptography.xlsx",
    "energy": "S&P-Energy.xlsx",
    "materials": "S&P-Materials.xlsx",
    "neuroscience": "S&P-Neuroscience.xlsx",
    "robotics": "S&P-Robotics.xlsx",
    "semiconductors": "S&P-Semiconductors.xlsx",
    "space": "S&P-Space.xlsx",
}

HEADER_ROW_IDX = 2  # 0-indexed
JUNK_ROWS_AFTER_HEADER = 3

# Known real variants of the announcement-date column seen across exports
# this session — checked in this order.
DATE_COLUMN_ALIASES = ["Announced Date", "Completion Date", "Closed Date"]

DUPLICATE_NAME_COL = "Target/Issuer Name"

TEXT_COLS_TO_CONCAT = ["Deal Summary", "Business Description (Target/Issuer)"]

TRANSACTION_ID_COL = "CIQ Transaction ID"
INVESTOR_COL = "Buyers/Investors Name"

# Rescue threshold: a row with no strong keyword match (kw_tier == "none")
# whose cosine similarity to this field's seed phrases is >= this value
# gets rescued into the "review" tier instead of "drop". Named constant,
# tune here rather than hunting through the scoring code.
COSINE_RESCUE_THRESHOLD = 0.45

EMBED_MODEL_NAME = "all-MiniLM-L6-v2"

WORD_BOUNDARY_CACHE: dict[str, re.Pattern] = {}


def _term_pattern(term: str) -> re.Pattern:
    pat = WORD_BOUNDARY_CACHE.get(term)
    if pat is None:
        pat = re.compile(r"\b" + re.escape(term.lower()) + r"\b")
        WORD_BOUNDARY_CACHE[term] = pat
    return pat


def _flatten_header(raw: str) -> str:
    """'Total Transaction Value\\n($M)' -> 'Total Transaction Value ($M)'"""
    if not isinstance(raw, str):
        return raw
    return re.sub(r"\s+", " ", raw.replace("\n", " ")).strip()


def _find_date_column(columns: list[str]) -> str | None:
    """Matches by prefix, not exact equality — the real flattened header
    keeps the date-format suffix (e.g. "Completion Date MM/dd/yyyy"), which
    an exact match against "Completion Date" would silently miss. Confirmed
    by hand (2026-07-25): this was a real bug, not a real absence of a date
    column — every one of the 10 real exports actually has one."""
    for alias in DATE_COLUMN_ALIASES:
        for col in columns:
            if col.startswith(alias):
                return col
    return None


@dataclass
class LoadResult:
    df: pd.DataFrame
    raw_row_count: int
    date_column: str | None
    field: str
    source_path: Path


def load_export(field: str, path: Path) -> LoadResult:
    """Reads Sheet1 of a real CapIQ Transactions export, applying the real,
    hand-verified layout quirks documented at the top of this file."""
    if not path.exists():
        raise FileNotFoundError(f"{field}: no file at {path}")

    raw = pd.read_excel(path, sheet_name="Sheet1", header=HEADER_ROW_IDX)
    raw_row_count = len(raw)
    df = raw.iloc[JUNK_ROWS_AFTER_HEADER:].reset_index(drop=True)

    df.columns = [_flatten_header(c) for c in df.columns]

    # Drop the duplicate Target/Issuer Name column (pandas suffixes repeats
    # with ".1", ".2", ... after header flattening collapses any prior
    # distinguishing whitespace).
    dupe_cols = [c for c in df.columns if c == DUPLICATE_NAME_COL or re.match(rf"^{re.escape(DUPLICATE_NAME_COL)}\.\d+$", c)]
    if len(dupe_cols) > 1:
        df = df.drop(columns=dupe_cols[1:])

    date_col = _find_date_column(list(df.columns))

    # Drop fully-blank rows that can slip in at the tail of an export.
    df = df.dropna(how="all").reset_index(drop=True)

    print(
        f"[{field}] loaded {path.name}: {raw_row_count} raw rows (incl. header junk) "
        f"-> {len(df)} data rows, {len(df.columns)} columns, "
        f"date column: {date_col or '(none found — checked ' + ', '.join(DATE_COLUMN_ALIASES) + ')'}"
    )
    if raw_row_count in (1000, 5000, 10000, 25000, 50000, 100000):
        print(f"[{field}] WARNING: raw row count {raw_row_count} is a suspiciously round number — check for an export row cap")

    return LoadResult(df=df, raw_row_count=raw_row_count, date_column=date_col, field=field, source_path=path)


def dedup_transactions(df: pd.DataFrame) -> pd.DataFrame:
    if TRANSACTION_ID_COL not in df.columns:
        raise KeyError(f"expected transaction id column {TRANSACTION_ID_COL!r} not found; have: {list(df.columns)}")
    before = len(df)
    out = df.drop_duplicates(subset=[TRANSACTION_ID_COL], keep="first").reset_index(drop=True)
    print(f"dedup_transactions: {before} -> {len(out)} rows ({before - len(out)} duplicate transaction rows dropped)")
    return out


_INVESTOR_TYPE_RE = re.compile(r"^(.*?)\s*\(([^)]+)\)\s*$")


def explode_investors(df: pd.DataFrame) -> pd.DataFrame:
    """One row per investor per transaction, investor_name/investor_type
    parsed out of the semicolon-delimited, parenthetical-suffixed
    Buyers/Investors Name field."""
    if INVESTOR_COL not in df.columns:
        raise KeyError(f"expected investor column {INVESTOR_COL!r} not found; have: {list(df.columns)}")

    records = []
    for _, row in df.iterrows():
        raw = row.get(INVESTOR_COL)
        if not isinstance(raw, str) or not raw.strip():
            continue
        for chunk in raw.split(";"):
            chunk = chunk.strip()
            if not chunk:
                continue
            m = _INVESTOR_TYPE_RE.match(chunk)
            investor_name = m.group(1).strip() if m else chunk
            investor_type = m.group(2).strip() if m else None
            rec = row.to_dict()
            rec["investor_name"] = investor_name
            rec["investor_type"] = investor_type
            records.append(rec)
    out = pd.DataFrame.from_records(records)
    print(f"explode_investors: {len(df)} transactions -> {len(out)} investor-level rows")
    return out


def _concat_text(row: pd.Series) -> str:
    parts = []
    for col in TEXT_COLS_TO_CONCAT:
        val = row.get(col)
        if isinstance(val, str) and val.strip():
            parts.append(val)
    text = " ".join(parts).lower()
    return re.sub(r"\s+", " ", text).strip()


def tag_keywords(df: pd.DataFrame, field_dict: dict) -> pd.DataFrame:
    """Adds kw_matched_strong, kw_matched_contextual, kw_matched_kill,
    kw_score, kw_tier columns. Tier logic: any kill match -> "drop"
    (absolute, no rescue); 2+ strong -> "strong"; 1 strong -> "likely";
    0 strong -> "none" (contextual terms alone never elevate the tier,
    per spec — they only count as evidence once a strong term already
    co-occurred, reflected here in kw_score, not in kw_tier)."""
    df = df.copy()
    text_series = df.apply(_concat_text, axis=1)

    strong_terms = field_dict.get("strong", [])
    contextual_terms = field_dict.get("contextual", [])
    kill_terms = field_dict.get("kill", [])

    matched_strong_list = []
    matched_contextual_list = []
    matched_kill_list = []
    kw_score_list = []
    kw_tier_list = []

    for text in text_series:
        strong_hits = [t for t in strong_terms if _term_pattern(t).search(text)]
        contextual_hits = [t for t in contextual_terms if _term_pattern(t).search(text)]
        kill_hits = [t for t in kill_terms if _term_pattern(t).search(text)]

        if kill_hits:
            tier = "drop"
            score = 0.0
        elif len(strong_hits) >= 2:
            tier = "strong"
            score = 3 * len(strong_hits) + len(contextual_hits)
        elif len(strong_hits) == 1:
            tier = "likely"
            score = 3 * len(strong_hits) + len(contextual_hits)
        else:
            tier = "none"
            score = 0.0  # contextual-only matches don't count without a strong co-occurrence

        matched_strong_list.append(strong_hits)
        matched_contextual_list.append(contextual_hits)
        matched_kill_list.append(kill_hits)
        kw_score_list.append(score)
        kw_tier_list.append(tier)

    df["_concat_text"] = text_series
    df["kw_matched_strong"] = matched_strong_list
    df["kw_matched_contextual"] = matched_contextual_list
    df["kw_matched_kill"] = matched_kill_list
    df["kw_score"] = kw_score_list
    df["kw_tier"] = kw_tier_list
    return df


class Embedder:
    """Lazy singleton wrapper around the sentence-transformers model — real
    model load cost (~seconds, plus a one-time download) is paid once per
    process regardless of how many fields get embedded."""

    _model = None

    @classmethod
    def get(cls):
        if cls._model is None:
            from sentence_transformers import SentenceTransformer

            print(f"loading embedding model {EMBED_MODEL_NAME} (first call only)...")
            cls._model = SentenceTransformer(EMBED_MODEL_NAME)
        return cls._model


def _file_hash(path: Path) -> str:
    stat = path.stat()
    key = f"{path.name}:{stat.st_size}:{stat.st_mtime_ns}"
    return hashlib.sha256(key.encode()).hexdigest()[:16]


def embed_and_score(df: pd.DataFrame, seeds: list[str], field: str, source_path: Path) -> pd.DataFrame:
    """Adds cosine_score = max cosine similarity between each row's
    concatenated text and any of the field's seed phrases. Caches the
    row-text embeddings to disk keyed by (field, file hash, row count) so
    re-running against an unchanged export doesn't re-embed."""
    if not seeds:
        raise ValueError(f"{field}: SEEDS_BY_FIELD is empty — fill in real seed phrases in keywords.py before embedding")

    df = df.copy()
    EMBED_CACHE_DIR.mkdir(exist_ok=True)
    cache_path = EMBED_CACHE_DIR / f"{field}_{_file_hash(source_path)}_{len(df)}.npy"

    if cache_path.exists():
        print(f"[{field}] embedding cache hit: {cache_path.name}")
        row_embeddings = np.load(cache_path)
    else:
        model = Embedder.get()
        print(f"[{field}] embedding {len(df)} rows (no cache found)...")
        row_embeddings = model.encode(df["_concat_text"].tolist(), show_progress_bar=True, batch_size=64)
        np.save(cache_path, row_embeddings)

    model = Embedder.get()
    seed_embeddings = model.encode(seeds)

    # Cosine similarity, normalized by hand (avoids adding a scipy/sklearn
    # dependency just for this).
    def _cosine_matrix(a: np.ndarray, b: np.ndarray) -> np.ndarray:
        a_norm = a / np.clip(np.linalg.norm(a, axis=1, keepdims=True), 1e-9, None)
        b_norm = b / np.clip(np.linalg.norm(b, axis=1, keepdims=True), 1e-9, None)
        return a_norm @ b_norm.T

    sims = _cosine_matrix(row_embeddings, seed_embeddings)
    df["cosine_score"] = sims.max(axis=1)
    df["cosine_best_seed"] = [seeds[i] for i in sims.argmax(axis=1)]
    return df


def combine_classification(df: pd.DataFrame, rescue_threshold: float = COSINE_RESCUE_THRESHOLD) -> pd.DataFrame:
    """Final `classification` column: keyword tier is the spine (kill ->
    drop is absolute, never rescued — see tag_keywords' docstring), rows
    with no keyword signal (kw_tier == "none") get one more chance via
    cosine similarity into a "review" tier rather than an outright drop."""
    df = df.copy()

    def _classify(row) -> str:
        if row["kw_tier"] == "drop":
            return "drop"
        if row["kw_tier"] in ("strong", "likely"):
            return row["kw_tier"]
        # kw_tier == "none"
        if row.get("cosine_score", 0.0) >= rescue_threshold:
            return "review"
        return "drop"

    df["classification"] = df.apply(_classify, axis=1)
    return df


def process_field(field: str, test_only: bool = False) -> dict:
    if field not in FILES_BY_FIELD:
        raise KeyError(f"no file configured for field {field!r} — see FILES_BY_FIELD in pipeline.py")
    field_dict = KEYWORDS_BY_FIELD.get(field)
    seeds = SEEDS_BY_FIELD.get(field)
    if not field_dict or not any(field_dict.values()):
        raise ValueError(f"{field}: keyword dict in keywords.py is still an empty stub — fill it in before running")

    path = CIQ_DATA_DIR / FILES_BY_FIELD[field]
    loaded = load_export(field, path)
    df = dedup_transactions(loaded.df)
    df = tag_keywords(df, field_dict)

    if test_only:
        print(f"\n[{field}] TEST MODE — shape after load+dedup+keyword-tag: {df.shape}")
        print(f"[{field}] columns: {list(df.columns)}")
        cols_to_show = [c for c in ["Target/Issuer Name", "Transaction Type", "kw_tier", "kw_score", "kw_matched_strong"] if c in df.columns]
        print(df[cols_to_show].head(10).to_string())
        print(f"\n[{field}] kw_tier distribution:\n{df['kw_tier'].value_counts()}")
        return {"field": field, "df": df, "loaded": loaded}

    df = embed_and_score(df, seeds, field, path)
    df = combine_classification(df)

    investor_df = explode_investors(loaded.df)  # explode from the pre-dedup, pre-tag frame per spec (investor-level stays exploded, not deduped on transaction id)

    OUTPUT_DIR.mkdir(exist_ok=True)
    out_path = OUTPUT_DIR / f"{field}.xlsx"
    with pd.ExcelWriter(out_path, engine="openpyxl") as writer:
        df.drop(columns=["_concat_text"]).to_excel(writer, sheet_name="transactions_tagged", index=False)
        investor_df.to_excel(writer, sheet_name="investor_level", index=False)
    print(f"[{field}] wrote {out_path} ({len(df)} transactions, {len(investor_df)} investor rows)")

    print(f"[{field}] classification breakdown:\n{df['classification'].value_counts()}")
    return {"field": field, "df": df, "investor_df": investor_df, "loaded": loaded, "out_path": out_path}


def combine_all_fields(results: list[dict]) -> pd.DataFrame:
    frames = []
    for r in results:
        df = r["df"].drop(columns=["_concat_text"], errors="ignore").copy()
        df["field"] = r["field"]
        frames.append(df)
    combined = pd.concat(frames, ignore_index=True)

    overlap_ids = (
        combined.groupby(TRANSACTION_ID_COL)["field"]
        .nunique()
        .loc[lambda s: s > 1]
        .index
    )
    overlap_count = len(overlap_ids)

    OUTPUT_DIR.mkdir(exist_ok=True)
    out_path = OUTPUT_DIR / "all_fields.parquet"
    combined.to_parquet(out_path, index=False)
    print(f"wrote {out_path}: {len(combined)} rows across {combined['field'].nunique()} fields, {overlap_count} deals appear in more than one field")
    return combined


def write_summary(results: list[dict], combined: pd.DataFrame) -> None:
    lines = ["# CapIQ classification pipeline summary", ""]
    for r in results:
        loaded = r["loaded"]
        df = r["df"]
        lines.append(f"## {r['field']}")
        lines.append(f"- source: {loaded.source_path.name}")
        lines.append(f"- raw rows (incl. header junk): {loaded.raw_row_count}")
        lines.append(f"- date column found: {loaded.date_column or '(none)'}")
        lines.append(f"- transactions after dedup: {len(df)}")
        lines.append("- classification breakdown:")
        for tier, count in df["classification"].value_counts().items():
            lines.append(f"  - {tier}: {count}")
        lines.append("")

    overlap_ids = (
        combined.groupby(TRANSACTION_ID_COL)["field"]
        .nunique()
        .loc[lambda s: s > 1]
    )
    lines.append(f"## Cross-field overlap: {len(overlap_ids)} transactions appear under more than one field")
    lines.append("")

    OUTPUT_DIR.mkdir(exist_ok=True)
    summary_path = OUTPUT_DIR / "summary.md"
    summary_path.write_text("\n".join(lines))
    print(f"wrote {summary_path}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--field", help="single field key, e.g. quantum")
    parser.add_argument("--all", action="store_true", help="run every configured field")
    parser.add_argument("--test", action="store_true", help="load+dedup+keyword-tag only, print a sample, write no files (no embedding)")
    args = parser.parse_args()

    if args.test:
        if not args.field:
            print("--test requires --field", file=sys.stderr)
            sys.exit(1)
        process_field(args.field, test_only=True)
        return

    if args.all:
        fields = list(FILES_BY_FIELD.keys())
    elif args.field:
        fields = [args.field]
    else:
        print("pass --field <name> [--test] or --all", file=sys.stderr)
        sys.exit(1)

    results = [process_field(f) for f in fields]
    combined = combine_all_fields(results)
    write_summary(results, combined)


if __name__ == "__main__":
    main()
