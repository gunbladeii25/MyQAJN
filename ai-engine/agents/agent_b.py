"""
Agent B: Discrepancy Index Computation and Anomaly Detection
AI Category: Rule-Based (DI formula, flags, verdict) + ML (Isolation Forest for anomaly_score)
"""
import os
import joblib
import numpy as np
from pathlib import Path
from utils.di_calculator import compute_di, classify_di, get_enforcement_actions, get_policy_for_flag
from utils.flag_engine import generate_flags
from ingestion.skpm_structure import identify_weak_domains

MODELS_PATH = Path(os.getenv("MODELS_PATH", "./models"))
DEFAULT_JN_SCORE = 60.0
_anomaly_model = None


def _load_anomaly_model():
    global _anomaly_model
    model_path = MODELS_PATH / "anomaly_model.pkl"
    if model_path.exists():
        _anomaly_model = joblib.load(model_path)
    return _anomaly_model


def _compute_anomaly_score(di: float, risk_index: float, flag_count: int, a_confidence: float, days_stale: int, hygiene: float) -> float:
    """Isolation Forest anomaly score — negative = more anomalous."""
    model = _load_anomaly_model()
    if model is None:
        # Fallback: simple linear score when no model trained yet
        return round(-(di * 0.6 + flag_count * 0.05), 4)

    features = [[di, risk_index, flag_count, a_confidence, days_stale / 365, hygiene / 100]]
    try:
        score = model.decision_function(features)[0]
        return round(float(score), 4)
    except Exception:
        return round(-(di * 0.6 + flag_count * 0.05), 4)


def run(payload: dict, agent_a_output: dict) -> dict:
    operational_score = float(payload.get("operational_score", 0))
    jn_audit_score = payload.get("jn_audit_score")
    has_audit_record = jn_audit_score is not None

    if not has_audit_record:
        jn_audit_score = DEFAULT_JN_SCORE

    jn_audit_score = float(jn_audit_score)

    # DI formula — Rule-Based (deterministic)
    di_value = compute_di(jn_audit_score, operational_score)
    di_classification, alert_level = classify_di(di_value)

    # School metadata for flag generation
    school_data = {
        "integrity_risk_index": payload.get("integrity_risk_index", 0),
        "canteen_hygiene_score": payload.get("canteen_hygiene_score"),
        "last_audit_date": payload.get("last_audit_date"),
        "emis_access_suspended": payload.get("emis_access_suspended", False),
        "school_code_match": agent_a_output.get("school_code_match", True),
        "has_audit_record": has_audit_record,
    }

    # Risk flags — Rule-Based
    risk_flags = generate_flags(
        di_value=di_value,
        category=agent_a_output.get("category", ""),
        severity=agent_a_output.get("severity", "LOW"),
        school_data=school_data,
        repeat_count=payload.get("repeat_count", 0),
    )

    # Domain SKPM terlemah — untuk syor Agent C yang spesifik kepada bidang
    # (bukan kenyataan generik). Utamakan domain_di (perbandingan dua belah
    # dari kelulusan ingestion); fallback ke jn_domain_scores (snapshot audit
    # JN sahaja) apabila kes dicipta secara manual tanpa mapping ingestion.
    # Dikira SEBELUM anomaly_detected/confidence supaya WEAK_DOMAIN_* flags
    # turut dikira dalam len(risk_flags) — elak UI papar cangang (cth. 2+
    # flag tetapi anomaly_detected: false).
    weak_domains = identify_weak_domains(
        jn_domain_scores=payload.get("jn_domain_scores"),
        domain_di=payload.get("domain_di"),
    )
    for wd in weak_domains:
        risk_flags.append(f"WEAK_DOMAIN_{wd['domain'].upper()}")

    # Anomaly score — Isolation Forest (ML, enhancement only)
    hygiene_val = float(payload.get("canteen_hygiene_score")) if payload.get("canteen_hygiene_score") is not None else 100.0
    risk_idx = float(payload.get("integrity_risk_index", 0))
    a_conf = float(agent_a_output.get("confidence", 0.5))
    days_stale = 0
    last_audit = payload.get("last_audit_date")
    if last_audit:
        from datetime import date, datetime
        try:
            if isinstance(last_audit, str):
                la = datetime.fromisoformat(last_audit).date()
            else:
                la = last_audit
            days_stale = (date.today() - la).days
        except Exception:
            days_stale = 0

    anomaly_score = _compute_anomaly_score(di_value, risk_idx, len(risk_flags), a_conf, days_stale, hygiene_val)

    # Anomaly verdict — Rule-Based (dual-condition)
    anomaly_detected = (di_value >= 0.25) or (len(risk_flags) >= 2)

    # Confidence formula
    penalty = 0.60 if not has_audit_record else 1.0
    isolation_boost = max(0.0, -anomaly_score * 0.1)
    base = min(1.0, di_value * 1.5 + min(0.3, len(risk_flags) * 0.06))
    confidence = round(min(1.0, base + isolation_boost) * penalty, 3)

    # Policy recommendations per flag
    policy_recommendations = []
    for flag in risk_flags:
        policy = get_policy_for_flag(flag)
        if policy:
            policy_recommendations.append({"flag": flag, **policy})

    return {
        "di_value": di_value,
        "di_classification": di_classification,
        "alert_level": alert_level,
        "jn_audit_score_used": jn_audit_score,
        "has_audit_record": has_audit_record,
        "risk_flags": risk_flags,
        "anomaly_score": anomaly_score,
        "anomaly_detected": anomaly_detected,
        "confidence": confidence,
        "policy_recommendations": policy_recommendations,
        "weak_domains": weak_domains,
    }
