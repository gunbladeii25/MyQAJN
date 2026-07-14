"""
Mapping Engine — Map field data luar ke standard/domain SKPM, kira composite
operational score dan DI (komposit + per-standard).

Flow:
  external_scores (dari connector/agent_0)
      ↓
  field_mappings config (dari data_source.field_mappings)
      ↓
  mapped_scores (field luar → domain SKPM: kekuatan, pengurusan_hem, ...)
      ↓
  composite_operational_score (weighted average)
      ↓
  bandingkan vs jn_audit_score → DI komposit
  bandingkan mapped_scores[domain] vs jn_domain_scores[domain] → DI per standard
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ── Default field mapping (field data luar → domain SKPM) ────────────────────
# Kunci jn_dimension MESTI sepadan dengan SKPM_DOMAINS (skpm_structure.py) dan
# kolum JnDomainScore.domain dalam DB — perbandingan DI per standard hanya sah
# jika kedua-dua belah guna dimensi yang sama (apple-to-apple).
# Admin boleh override ini dalam data_source.field_mappings (JSON).
DEFAULT_MAPPINGS = {
    # EMIS fields
    "academic_performance":  {"jn_dimension": "kemenjadian_murid",      "weight": 0.30},  # 5.1 Akademik
    "attendance_rate":       {"jn_dimension": "pengurusan_hem",         "weight": 0.20},  # 3.3 Disiplin/Kebajikan
    "facilities_score":      {"jn_dimension": "kekuatan",               "weight": 0.15},  # A4–A7 Prasarana
    "teacher_qualification": {"jn_dimension": "kekuatan",               "weight": 0.15},  # A1 Guru
    "co_curriculum":         {"jn_dimension": "pengurusan_kokurikulum", "weight": 0.10},  # Standard 3.2
    # APDM fields
    "exam_pass_rate":        {"jn_dimension": "kemenjadian_murid",      "weight": 0.20},  # 5.1
    "dropout_rate_inv":      {"jn_dimension": "pengurusan_hem",         "weight": 0.10},  # inverted: higher = worse
    # Document-extracted fields (from Agent 0)
    "academic_performance_doc": {"jn_dimension": "kemenjadian_murid",   "weight": 0.25},
    "facilities_doc":           {"jn_dimension": "kekuatan",            "weight": 0.15},
    "discipline_doc":           {"jn_dimension": "pengurusan_hem",      "weight": 0.10},
    "hygiene_canteen":          {"jn_dimension": "pengurusan_hem",      "weight": 0.05},
    # Generic fallback
    "unlabelled_score":      {"jn_dimension": "pengurusan_kurikulum",   "weight": 0.10},
}

# ── DI classification thresholds ─────────────────────────────────────────────
DI_THRESHOLDS = [
    (0.75, "EXTREME_DISCREPANCY", "RED"),
    (0.50, "SEVERE_DISCREPANCY",  "ORANGE"),
    (0.25, "MODERATE_DISCREPANCY","YELLOW"),
    (0.10, "MINOR_DISCREPANCY",   "BLUE"),
    (0.00, "DATA_ALIGNED",        "GREEN"),
]


def map_and_score(
    extracted_scores: dict,
    jn_audit_score: Optional[float],
    field_mappings_config: Optional[dict] = None,
    jn_domain_scores: Optional[dict] = None,
) -> dict:
    """
    Map external scores ke domain SKPM, kira composite score dan DI.

    Args:
        extracted_scores    : {field_name: float} dari connector atau agent_0
        jn_audit_score      : skor audit JN komposit dari DB sekolah (ground truth)
        field_mappings_config: override dari data_source.field_mappings (JSON)
        jn_domain_scores    : {domain: skor} — baris JnDomainScore terkini sekolah
                              (untuk DI per standard; None = komposit sahaja)

    Returns:
        {
            mapped_scores, composite_operational_score,
            jn_audit_score, discrepancy_index, di_classification,
            alert_level, domain_di, mapping_coverage, confidence
        }
        domain_di: {domain: {jn_score, operational_score, di, classification, alert}}
                   — hanya domain yang ada skor di KEDUA-DUA belah.
    """
    mappings = {**DEFAULT_MAPPINGS, **(field_mappings_config or {})}

    # ── Step 1: Map fields → JN dimensions ───────────────────────────────────
    dimension_scores = {}   # {jn_dimension: [weighted contributions]}
    dimension_weights = {}  # {jn_dimension: total weight}
    mapped_fields = []

    for field, value in extracted_scores.items():
        if value is None or field not in mappings:
            continue
        config = mappings[field]
        dim = config["jn_dimension"]
        w   = config.get("weight", 0.10)

        if dim not in dimension_scores:
            dimension_scores[dim] = []
            dimension_weights[dim] = 0

        dimension_scores[dim].append(value * w)
        dimension_weights[dim] += w
        mapped_fields.append(field)

    # ── Step 2: Compute per-dimension average ─────────────────────────────────
    mapped_scores = {}
    for dim, contributions in dimension_scores.items():
        if dimension_weights[dim] > 0:
            mapped_scores[dim] = round(sum(contributions) / dimension_weights[dim], 2)

    # ── Step 3: Composite operational score (weighted average across dims) ────
    total_weight  = sum(dimension_weights.values())
    weighted_sum  = sum(
        mapped_scores[dim] * dimension_weights[dim]
        for dim in mapped_scores
    )
    composite = round(weighted_sum / total_weight, 2) if total_weight > 0 else None

    # ── Step 4: DI computation ────────────────────────────────────────────────
    di_value = None
    di_class = None
    alert    = None

    if composite is not None and jn_audit_score is not None:
        di_value = round(abs(jn_audit_score - composite) / 100, 4)
        for threshold, cls, lvl in DI_THRESHOLDS:
            if di_value >= threshold:
                di_class = cls
                alert    = lvl
                break

    # ── Step 4b: DI per standard SKPM (apple-to-apple) ────────────────────────
    # Bandingkan hanya domain yang ada skor operasi DAN skor JN — domain tanpa
    # padanan (cth. pdpc tiada field EMIS) dikecualikan, bukan diberi DI palsu.
    domain_di = {}
    for dim, ops_score in mapped_scores.items():
        jn_dim_score = (jn_domain_scores or {}).get(dim)
        if jn_dim_score is None:
            continue
        d = round(abs(jn_dim_score - ops_score) / 100, 4)
        cls, lvl = classify_di(d)
        domain_di[dim] = {
            "jn_score":          jn_dim_score,
            "operational_score": ops_score,
            "di":                d,
            "classification":    cls,
            "alert":             lvl,
        }

    # Coverage: berapa % dari default mapping fields berjaya dipetakan
    coverage = round(len(mapped_fields) / max(len(DEFAULT_MAPPINGS), 1), 2)
    confidence = min(1.0, coverage * 1.2)

    logger.debug(f"Mapping: {len(mapped_fields)} fields → composite={composite} | DI={di_value}")

    return {
        "mapped_scores":                mapped_scores,
        "composite_operational_score":  composite,
        "jn_audit_score":               jn_audit_score,
        "discrepancy_index":            di_value,
        "di_classification":            di_class,
        "alert_level":                  alert,
        "domain_di":                    domain_di,
        "mapped_fields":                mapped_fields,
        "mapping_coverage":             coverage,
        "confidence":                   round(confidence, 3),
    }


def classify_di(di_value: float) -> tuple[str, str]:
    """Return (di_classification, alert_level) for a given DI value."""
    for threshold, cls, lvl in DI_THRESHOLDS:
        if di_value >= threshold:
            return cls, lvl
    return "DATA_ALIGNED", "GREEN"


def extracted_to_skpm_domains(extracted_scores: dict) -> tuple[dict, float | None, bool]:
    """
    Tukar field Agent 0 (cth. facilities_doc) → skor domain SKPM, guna
    DEFAULT_MAPPINGS yang sama dengan pengiraan DI supaya konsisten.

    Dikongsi oleh /ai/ingest/jn-document (muat naik manual) dan
    GDriveConnector real mode (tarikan syor dari Drive).

    Returns: (domain_scores, composite, partial)
      domain_scores: {domain: {label, komponen, score}}
      composite:     komposit dinormalisasi atas domain yang diliputi (None jika kosong)
      partial:       True jika tidak semua standard SKPM diliputi
    """
    from .skpm_structure import SKPM_DOMAINS, DOMAIN_WEIGHTS

    domain_values = {}
    for field, value in (extracted_scores or {}).items():
        if value is None or field not in DEFAULT_MAPPINGS:
            continue
        dom = DEFAULT_MAPPINGS[field]["jn_dimension"]
        if dom in SKPM_DOMAINS:
            domain_values.setdefault(dom, []).append(value)

    domain_scores = {
        dom: {
            "label":    SKPM_DOMAINS[dom]["label"],
            "komponen": SKPM_DOMAINS[dom]["komponen"],
            "score":    round(sum(vals) / len(vals), 2),
        }
        for dom, vals in domain_values.items()
    }

    covered = list(domain_scores)
    composite = None
    if covered:
        total_w   = sum(DOMAIN_WEIGHTS[d] for d in covered)
        composite = round(sum(domain_scores[d]["score"] * DOMAIN_WEIGHTS[d] for d in covered) / total_w, 2)

    return domain_scores, composite, len(covered) < len(SKPM_DOMAINS)
