"""
JN Connector — Dapatan Data Audit Jemaah Nazir

Ini mock data untuk dapatan JN (SKPMG2 audit scores).
Dalam sistem sebenar, data JN sudah ada dalam DB sekolah (jn_audit_score).
Connector ini ready untuk sync dengan JN API endpoint masa hadapan.

MOCK MODE:
  Returns domain-level audit scores per sekolah berdasarkan SKPMG2.

REAL API MODE (USE_MOCK=False):
  Sync dengan sistem JN internal (bila API JN tersedia dari KPM).
  Set JN_API_URL dan JN_API_TOKEN dalam .env.
"""

import random
import logging
from datetime import date
from .base_connector import BaseConnector

logger = logging.getLogger(__name__)

# ── Mock SKPMG2 Domain scores baseline ──────────────────────────────────────
# 6 domain SKPMG2 per jenis sekolah
MOCK_JN_BASELINE = {
    "SBP":  {"domain_kepimpinan": 90, "domain_pengurusan": 88, "domain_kurikulum": 87, "domain_pdpc": 85, "domain_kemajuan_murid": 88, "domain_keselamatan": 92},
    "MRSM": {"domain_kepimpinan": 86, "domain_pengurusan": 85, "domain_kurikulum": 84, "domain_pdpc": 82, "domain_kemajuan_murid": 85, "domain_keselamatan": 89},
    "SMK":  {"domain_kepimpinan": 72, "domain_pengurusan": 70, "domain_kurikulum": 68, "domain_pdpc": 65, "domain_kemajuan_murid": 70, "domain_keselamatan": 74},
    "SK":   {"domain_kepimpinan": 70, "domain_pengurusan": 68, "domain_kurikulum": 65, "domain_pdpc": 63, "domain_kemajuan_murid": 67, "domain_keselamatan": 71},
    "SJK":  {"domain_kepimpinan": 73, "domain_pengurusan": 71, "domain_kurikulum": 70, "domain_pdpc": 67, "domain_kemajuan_murid": 71, "domain_keselamatan": 74},
    "SKK":  {"domain_kepimpinan": 60, "domain_pengurusan": 58, "domain_kurikulum": 55, "domain_pdpc": 52, "domain_kemajuan_murid": 57, "domain_keselamatan": 62},
}
DEFAULT_JN = {"domain_kepimpinan": 68, "domain_pengurusan": 65, "domain_kurikulum": 63, "domain_pdpc": 60, "domain_kemajuan_murid": 65, "domain_keselamatan": 70}


class JNConnector(BaseConnector):
    SOURCE_CODE = "JN_INTERNAL"
    SOURCE_NAME = "Dapatan Audit Jemaah Nazir (SKPMG2)"
    USE_MOCK    = True   # ← Tukar ke False bila JN API tersedia

    def pull(self, school_codes: list[str], month: int, year: int) -> list[dict]:
        if self.USE_MOCK:
            return self._mock_pull(school_codes, month, year)
        else:
            return self._real_pull(school_codes, month, year)   # noqa

    def _mock_pull(self, school_codes: list[str], month: int, year: int) -> list[dict]:
        logger.info(f"{self._mock_label()} Pulling JN audit data for {len(school_codes)} schools")
        results = []
        for code in school_codes:
            school_type = self._detect_type(code)
            baseline = MOCK_JN_BASELINE.get(school_type, DEFAULT_JN)

            rng = random.Random(hash("JN" + code + str(year)))
            domain_scores = {
                domain: round(max(0, min(100, val + rng.uniform(-8, 8))), 1)
                for domain, val in baseline.items()
            }
            # Composite JN audit score = purata wajaran 6 domain
            weights = {"domain_kepimpinan": 0.20, "domain_pengurusan": 0.15,
                       "domain_kurikulum": 0.25, "domain_pdpc": 0.20,
                       "domain_kemajuan_murid": 0.15, "domain_keselamatan": 0.05}
            composite_jn = round(sum(domain_scores[d] * w for d, w in weights.items()), 2)

            results.append({
                "school_code":   code,
                "source_system": self.SOURCE_CODE,
                "pull_date":     date(year, month, 1).isoformat(),
                "data_type":     "quantitative",
                "scores":        domain_scores,
                "composite_jn_score": composite_jn,
                "last_audit_year":    year - 1,
                "raw_response":  {"mock": True, "school_code": code, "jn_domains": domain_scores, "composite": composite_jn},
            })

        return results

    # ── REAL JN API CALL (uncomment bila JN API tersedia) ────────────────────
    # def _real_pull(self, school_codes: list[str], month: int, year: int) -> list[dict]:
    #     import httpx
    #     results = []
    #     for code in school_codes:
    #         try:
    #             resp = httpx.get(
    #                 f"{self.api_url}/audit-results/{code}",
    #                 headers=self._headers(),
    #                 params={"year": year},
    #                 timeout=30,
    #             )
    #             resp.raise_for_status()
    #             data = resp.json()
    #             results.append({
    #                 "school_code":        code,
    #                 "source_system":      self.SOURCE_CODE,
    #                 "pull_date":          date(year, month, 1).isoformat(),
    #                 "data_type":          "quantitative",
    #                 "scores":             data.get("domain_scores", {}),
    #                 "composite_jn_score": data.get("composite_score"),
    #                 "raw_response":       data,
    #             })
    #         except Exception as e:
    #             logger.error(f"JN API error for {code}: {e}")
    #     return results

    @staticmethod
    def _detect_type(code: str) -> str:
        for t in ["SBP", "MRSM", "SMK", "SJK", "SKK", "SK"]:
            if t in code.upper():
                return t
        return "SK"
