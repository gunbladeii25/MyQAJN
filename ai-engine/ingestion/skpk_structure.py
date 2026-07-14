"""
SKPK — Struktur Standard Pra Sekolah (PLACEHOLDER)

⚠ NOTA PENTING: Struktur di bawah adalah PLACEHOLDER pembangunan sahaja.
Borang standard SKPK rasmi akan dibekalkan oleh pihak JN — apabila diterima,
gantikan SKPK_DOMAINS dan SKPK_WEIGHTS di sini (satu fail sahaja); connector,
DB (JnDomainScore), dan UI akan mengikut secara automatik, sama seperti
aliran SK@S (skpm_structure.py).

Kunci domain diberi awalan `skpk_` supaya tidak berlanggar dengan kunci
standard SKPM (kekuatan, pdpc, ...) dalam kolum JnDomainScore.domain —
kedua-dua instrumen boleh wujud serentak untuk institusi yang sama.
"""

SKPK_DOMAINS = {
    "skpk_kurikulum": {
        "label": "Kurikulum Pra Sekolah (SKPK)",
        "komponen": "Pengurusan Pra Sekolah",
    },
    "skpk_kepimpinan": {
        "label": "Kepimpinan Institusi (SKPK)",
        "komponen": "Pengurusan Pra Sekolah",
    },
    "skpk_kemajuan_murid": {
        "label": "Perkembangan Kanak-kanak (SKPK)",
        "komponen": "Pencapaian Pra Sekolah",
    },
    "skpk_pengurusan": {
        "label": "Pengurusan & Pentadbiran (SKPK)",
        "komponen": "Pengurusan Pra Sekolah",
    },
    "skpk_keselamatan": {
        "label": "Keselamatan & Kesihatan (SKPK)",
        "komponen": "Persekitaran Pra Sekolah",
    },
}

# Wajaran placeholder — sahkan dengan borang SKPK rasmi.
SKPK_WEIGHTS = {
    "skpk_kurikulum":      0.30,
    "skpk_kepimpinan":     0.20,
    "skpk_kemajuan_murid": 0.30,
    "skpk_pengurusan":     0.10,
    "skpk_keselamatan":    0.10,
}

assert abs(sum(SKPK_WEIGHTS.values()) - 1.0) < 1e-9, "SKPK_WEIGHTS mesti berjumlah 1.0"
