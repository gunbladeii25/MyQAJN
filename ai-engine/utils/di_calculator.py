"""DI formula, classification, and alert level mapping."""

DI_THRESHOLDS = [
    (0.75, "EXTREME_DISCREPANCY", "RED"),
    (0.50, "SEVERE_DISCREPANCY", "ORANGE"),
    (0.25, "MODERATE_DISCREPANCY", "YELLOW"),
    (0.10, "MINOR_DISCREPANCY", "BLUE"),
    (0.00, "DATA_ALIGNED", "GREEN"),
]

ENFORCEMENT_ACTIONS = {
    "EXTREME_DISCREPANCY": [
        "Jalankan audit buta (blind audit) dalam tempoh 24 jam",
        "Gantung akses EMIS sekolah dengan serta-merta",
        "Laporkan kepada KPM dan Pengarah JN Negeri",
        "Sediakan laporan insiden untuk semakan SPRM jika terdapat petunjuk penyelewengan",
        "Hantar pasukan audit khas ke sekolah",
    ],
    "SEVERE_DISCREPANCY": [
        "Jalankan audit mengejut (unannounced audit) dalam tempoh 48 jam",
        "Hantar notis rasmi kepada Pengetua / Guru Besar",
        "Laporkan kepada Pengarah Pendidikan Negeri",
        "Mulakan pemantauan intensif selama 60 hari",
    ],
    "MODERATE_DISCREPANCY": [
        "Keluarkan notis amaran rasmi kepada sekolah",
        "Mulakan pemantauan intensif selama 30 hari",
        "Semak dan sahkan semua data EMIS yang berkaitan",
        "Jadualkan audit susulan dalam tempoh 90 hari",
    ],
    "MINOR_DISCREPANCY": [
        "Keluarkan notis nasihat kepada sekolah",
        "Semak audit suku tahunan dalam rekod JN",
        "Minta penjelasan bertulis daripada pihak sekolah",
    ],
    "DATA_ALIGNED": [
        "Rekodkan dalam sistem pemantauan standard tahunan",
    ],
}

TEMPOH_TINDAKAN = {
    "EXTREME_DISCREPANCY": "24 jam untuk audit buta; 7 hari untuk laporan penuh kepada KPM dan Pengarah JN Negeri.",
    "SEVERE_DISCREPANCY": "48 jam untuk audit mengejut; 60 hari untuk pemantauan intensif.",
    "MODERATE_DISCREPANCY": "30 hari untuk pemantauan intensif; 90 hari untuk audit susulan.",
    "MINOR_DISCREPANCY": "90 hari untuk semakan audit suku tahunan.",
    "DATA_ALIGNED": "Tidak ada tempoh tindakan segera diperlukan.",
}

FLAG_POLICY_MAP = {
    "HIGH_INTEGRITY_RISK_SCHOOL": {
        "legal": "PKPA Bil. 5/2007, Seksyen 4.2",
        "action": "Jadualkan audit mengejut berkala setiap 3 bulan untuk sekolah berisiko tinggi",
    },
    "CANTEEN_HYGIENE_BELOW_THRESHOLD": {
        "legal": "Akta Makanan 1983 & Peraturan Kebersihan Kantin KPM",
        "action": "Hantar pasukan pemeriksaan kesihatan dalam 14 hari; pertimbangkan penutupan sementara kantin",
    },
    "AUDIT_DATA_STALE": {
        "legal": "Arahan Perbendaharaan 2017, Perenggan 28",
        "action": "Sekolah mesti diaudit dalam tempoh 60 hari; kemas kini jadual audit triennial JN",
    },
    "SCHOOL_CODE_MISMATCH": {
        "legal": "Dasar Keselamatan Data EMIS KPM 2022",
        "action": "Sahkan identiti sekolah secara manual sebelum memproses kes lanjut",
    },
    "POTENTIAL_DATA_MANIPULATION": {
        "legal": "Akta Pendidikan 1996, Seksyen 59 & Akta SPRM 2009",
        "action": "Wajibkan laporan SKPMG2 bertandatangan digital; rujuk SPRM jika disahkan",
    },
    "CRITICAL_SEVERITY_INCIDENT": {
        "legal": "Akta SPRM 2009 (Akta 694) & Arahan Keselamatan KPM",
        "action": "Eskalasi segera kepada Pengarah JN Negeri dan KPM Putrajaya",
    },
    "EMIS_ACCESS_PREVIOUSLY_SUSPENDED": {
        "legal": "Dasar EMIS KPM — Protokol Penggantungan Akses",
        "action": "Semak semula sebab penggantungan terdahulu sebelum memulihkan akses",
    },
    "NO_AUDIT_RECORD_FOUND": {
        "legal": "Dasar SKPMG2 Standard 1.0 — Liputan Pemeriksaan",
        "action": "Daftar sekolah dalam sistem JN dalam tempoh 14 hari kalender",
    },
    "REPEATED_DISCREPANCY": {
        "legal": "PKPA Bil. 5/2007, Seksyen 4 — Pemantauan Berterusan",
        "action": "Cadangkan siasatan dalaman oleh Bahagian Audit Dalaman KPM",
    },
}


def compute_di(jn_score: float, operational_score: float) -> float:
    return round(abs(jn_score - operational_score) / 100, 4)


def classify_di(di: float) -> tuple[str, str]:
    for threshold, classification, alert in DI_THRESHOLDS:
        if di >= threshold:
            return classification, alert
    return "DATA_ALIGNED", "GREEN"


def get_enforcement_actions(classification: str) -> list[str]:
    return ENFORCEMENT_ACTIONS.get(classification, ENFORCEMENT_ACTIONS["DATA_ALIGNED"])


def get_tempoh_tindakan(classification: str) -> str:
    return TEMPOH_TINDAKAN.get(classification, TEMPOH_TINDAKAN["DATA_ALIGNED"])


def get_policy_for_flag(flag: str) -> dict:
    for key, policy in FLAG_POLICY_MAP.items():
        if flag.startswith(key):
            return policy
    return {}
