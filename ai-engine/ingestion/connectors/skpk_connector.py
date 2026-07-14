"""
SKPK Connector — Sistem Kualiti Pra Sekolah (JN Baseline Source)

Returns JN quality scores for preschool institutions (Taska/Tadika).
Struktur standard dalam ingestion/skpk_structure.py (PLACEHOLDER — gantikan
apabila borang SKPK rasmi diterima).

Output mengikut bentuk yang sama dengan SK@S (domain_scores + domain_weights)
supaya backend menyimpan baris JnDomainScore per standard dan mengira semula
komposit dengan cara yang konsisten.

MOCK MODE (USE_MOCK=True): realistic mock scores (seed stabil crc32)
REAL API MODE (USE_MOCK=False): requires SKPK_API_URL + SKPK_API_TOKEN in .env
"""

import random
import logging
import zlib
from datetime import date
from .base_connector import BaseConnector
from ..skpk_structure import SKPK_DOMAINS, SKPK_WEIGHTS

logger = logging.getLogger(__name__)

# Purata baseline per jenis institusi pra-sekolah (mock)
MOCK_PRASEKOLAH_BASELINE = {
    "TASKA": {"skpk_kurikulum": 72, "skpk_kepimpinan": 68, "skpk_kemajuan_murid": 75, "skpk_pengurusan": 65, "skpk_keselamatan": 80},
    "TADIKA": {"skpk_kurikulum": 70, "skpk_kepimpinan": 65, "skpk_kemajuan_murid": 73, "skpk_pengurusan": 63, "skpk_keselamatan": 78},
    "PRASEKOLAH_KPM": {"skpk_kurikulum": 75, "skpk_kepimpinan": 72, "skpk_kemajuan_murid": 77, "skpk_pengurusan": 70, "skpk_keselamatan": 82},
}
DEFAULT_PRASEKOLAH = {"skpk_kurikulum": 70, "skpk_kepimpinan": 66, "skpk_kemajuan_murid": 73, "skpk_pengurusan": 64, "skpk_keselamatan": 79}


class SKPKConnector(BaseConnector):
    SOURCE_CODE = "SKPK"
    SOURCE_NAME = "Sistem Kualiti Pra Sekolah (SKPK)"
    USE_MOCK    = True   # ← Tukar ke False bila API endpoint dikonfigurasi

    def pull(self, school_codes: list[str], month: int, year: int) -> list[dict]:
        if self.USE_MOCK:
            return self._mock_pull(school_codes, month, year)
        else:
            return self._real_pull(school_codes, month, year)

    def _mock_pull(self, school_codes: list[str], month: int, year: int) -> list[dict]:
        logger.info(f"{self._mock_label()} SKPK mock pull for {len(school_codes)} schools")
        results = []
        for code in school_codes:
            institution_type = self._detect_prasekolah_type(code)
            baseline = MOCK_PRASEKOLAH_BASELINE.get(institution_type, DEFAULT_PRASEKOLAH)

            domain_scores = {}
            for dom, spec in SKPK_DOMAINS.items():
                rng = random.Random(zlib.crc32(f"{code}|{year}|{dom}|SKPK".encode()))
                score = round(max(0, min(100, baseline[dom] + rng.uniform(-6, 6))), 1)
                domain_scores[dom] = {
                    "label":    spec["label"],
                    "komponen": spec["komponen"],
                    "score":    score,
                }

            composite = round(
                sum(d["score"] * SKPK_WEIGHTS[k] for k, d in domain_scores.items()), 2
            )

            results.append({
                "school_code":        code,
                "source_system":      self.SOURCE_CODE,
                "pull_date":          date(year, month, 1).isoformat(),
                "data_type":          "quantitative",
                "jn_composite_score": composite,
                "domain_weights":     SKPK_WEIGHTS,
                "domain_scores":      domain_scores,
                "audit_period":       f"{year}-{month:02d}",
                "raw_response":       {"mock": True, "school_code": code, "year": year,
                                       "instrument": "SKPK_PLACEHOLDER",
                                       "dimensions": {k: d["score"] for k, d in domain_scores.items()}},
            })

        logger.info(f"{self._mock_label()} SKPK pull complete: {len(results)} schools")
        return results

    @staticmethod
    def _detect_prasekolah_type(school_code: str) -> str:
        code = school_code.upper()
        if "TASKA" in code:
            return "TASKA"
        if "TADIKA" in code or "TD" in code:
            return "TADIKA"
        return "PRASEKOLAH_KPM"
