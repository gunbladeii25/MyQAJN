"""
Bilingual keyword-weight taxonomy for Agent A domain classification.
Weights reflect diagnostic specificity: higher = more domain-specific.
"""

TAXONOMY = {
    "Facilities": {
        "bangunan": 0.8, "kemudahan": 0.7, "tandas": 0.9, "kantin": 0.8,
        "infrastruktur": 0.7, "bilik": 0.6, "dewan": 0.6, "padang": 0.5,
        "elektrik": 0.7, "paip": 0.8, "bocor": 0.9, "rosak": 0.7,
        "ubahsuai": 0.6, "pembinaan": 0.6, "peralatan": 0.6, "komputer": 0.5,
        "building": 0.8, "toilet": 0.9, "canteen": 0.8, "facility": 0.7,
        "infrastructure": 0.7, "classroom": 0.6, "hall": 0.5, "field": 0.4,
        "electrical": 0.7, "pipe": 0.7, "leaking": 0.9, "damaged": 0.7,
        "renovation": 0.6, "equipment": 0.6,
    },
    "Academic_Quality": {
        "skpmg2": 1.0, "pencapaian": 0.8, "akademik": 0.8, "peperiksaan": 0.8,
        "keputusan": 0.7, "upsr": 0.9, "spm": 0.9, "stpm": 0.9, "pt3": 0.9,
        "kurikulum": 0.8, "pdpc": 0.8, "guru": 0.5, "pelajar": 0.5,
        "prestasi": 0.8, "band": 0.7, "markah": 0.7, "gred": 0.7,
        "achievement": 0.8, "academic": 0.8, "exam": 0.8, "result": 0.7,
        "curriculum": 0.8, "teacher": 0.5, "student": 0.5, "performance": 0.8,
        "grade": 0.7, "score": 0.6, "assessment": 0.8, "pentaksiran": 0.8,
    },
    "Discipline": {
        "disiplin": 1.0, "ponteng": 0.9, "salah laku": 0.9, "pergaduhan": 0.9,
        "buli": 0.9, "vandalisma": 0.9, "dadah": 1.0, "rokok": 0.8,
        "kelakuan": 0.7, "tingkah laku": 0.7, "pesalah": 0.8, "hukuman": 0.7,
        "gantung": 0.8, "buang sekolah": 1.0, "tatatertib": 0.9,
        "discipline": 1.0, "truant": 0.9, "misconduct": 0.9, "fight": 0.9,
        "bully": 0.9, "vandalism": 0.9, "drugs": 1.0, "smoking": 0.8,
        "behavior": 0.7, "suspension": 0.8, "expulsion": 1.0,
    },
    "Administrative_Misconduct": {
        "penyelewengan": 1.0, "rasuah": 1.0, "salah guna": 0.9, "manipulasi": 1.0,
        "rekod palsu": 1.0, "pemalsuan": 1.0, "salah urus": 0.8, "kewangan": 0.7,
        "wang": 0.6, "peruntukan": 0.7, "kontrak": 0.7, "sprm": 1.0,
        "corruption": 1.0, "misconduct": 0.9, "falsification": 1.0,
        "misappropriation": 1.0, "fraud": 1.0, "mismanagement": 0.8,
        "financial": 0.7, "procurement": 0.7, "contract": 0.7,
        "data manipulation": 1.0, "false record": 1.0,
    },
}

SEVERITY_SIGNALS = {
    "CRITICAL": [
        "rasuah", "corruption", "sprm", "pemalsuan", "falsification",
        "fraud", "penyelewengan", "kecemasan", "emergency", "kematian", "death",
        "dadah", "drugs", "manipulasi data", "data manipulation", "rekod palsu",
    ],
    "HIGH": [
        "buli", "bully", "pergaduhan", "fight", "vandalisma", "vandalism",
        "salah guna", "misappropriation", "gantung", "suspension",
        "tidak selamat", "unsafe", "bahaya", "danger", "serious",
    ],
    "MEDIUM": [
        "ponteng", "truant", "disiplin", "discipline", "salah laku",
        "rosak", "damaged", "bocor", "leaking", "rendah", "low", "gagal", "fail",
    ],
    "LOW": [
        "aduan", "complaint", "laporan", "report", "isu", "issue",
        "masalah", "problem", "kurang", "lack", "tidak mencukupi", "insufficient",
    ],
}
