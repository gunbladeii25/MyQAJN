"""
Agent A: Semantic Ingestion and Domain Classification
AI Category: Hybrid — Rule-Based (NER, Severity) + ML Traditional (TF-IDF + Logistic Regression)
"""
import re
import os
import joblib
import numpy as np
from pathlib import Path
from keywords.taxonomy import TAXONOMY, SEVERITY_SIGNALS
from utils.checksum import compute_checksum

MODELS_PATH = Path(os.getenv("MODELS_PATH", "./models"))
SCHOOL_CODE_PATTERN = re.compile(
    r'\b(SK|SMK|SJK|MRSM|SBP|SKK|SEKOLAH\s+\w+)\s*\d{3,}\b', re.IGNORECASE
)

_classifier = None


def _load_classifier():
    global _classifier
    model_path = MODELS_PATH / "classifier_model.pkl"
    if model_path.exists():
        _classifier = joblib.load(model_path)
    return _classifier


def _rule_based_classify(text: str) -> tuple[str, float]:
    """Fallback: weighted keyword taxonomy classification."""
    text_lower = text.lower()
    scores = {}
    for category, keywords in TAXONOMY.items():
        score = sum(weight for kw, weight in keywords.items() if kw in text_lower)
        scores[category] = score

    total = sum(scores.values())
    if total == 0:
        return "Administrative_Misconduct", 0.25

    best = max(scores, key=scores.get)
    confidence = round(scores[best] / total, 3)
    return best, confidence


def _ml_classify(text: str) -> tuple[str, float, bool]:
    """ML classification using TF-IDF + Logistic Regression."""
    clf = _load_classifier()
    if clf is None:
        return None, 0.0, False

    try:
        proba = clf.predict_proba([text])[0]
        classes = clf.classes_
        idx = np.argmax(proba)
        return classes[idx], round(float(proba[idx]), 3), True
    except Exception:
        return None, 0.0, False


def _assess_severity(text: str) -> tuple[str, float]:
    text_lower = text.lower()
    for level in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
        matched = [s for s in SEVERITY_SIGNALS[level] if s in text_lower]
        if matched:
            confidence = min(1.0, len(matched) * 0.35)
            return level, round(confidence, 3)
    return "LOW", 0.25


def _detect_school_code(text: str, declared_school_id: str) -> tuple[str | None, bool]:
    matches = SCHOOL_CODE_PATTERN.findall(text)
    if not matches:
        return None, True  # No code in text — not a mismatch
    detected = matches[0] if isinstance(matches[0], str) else " ".join(matches[0]).strip()
    code_match = declared_school_id.upper().startswith(detected.upper().replace(" ", ""))
    return detected, code_match


def run(payload: dict) -> dict:
    text = payload.get("incident_text", "")
    school_id = payload.get("school_id", "")
    checksum = compute_checksum(text)

    # NER — school code detection (Rule-Based)
    detected_code, code_match = _detect_school_code(text, school_id)

    # Domain Classification — ML first, rule-based fallback
    ML_CONFIDENCE_THRESHOLD = 0.40
    ml_category, ml_confidence, ml_available = _ml_classify(text)

    if ml_available and ml_confidence >= ML_CONFIDENCE_THRESHOLD:
        category, confidence = ml_category, ml_confidence
        classification_method = "ml"
    else:
        category, confidence = _rule_based_classify(text)
        classification_method = "rule_based"

    # Severity — Rule-Based (deterministic)
    severity, severity_confidence = _assess_severity(text)

    return {
        "category": category,
        "confidence": confidence,
        "classification_method": classification_method,
        "severity": severity,
        "severity_confidence": severity_confidence,
        "school_code_detected": detected_code,
        "school_code_match": code_match,
        "checksum": checksum,
    }
