"""
EMIS Connector — Education Management Information System (KPM)

MOCK MODE (USE_MOCK=True):
  Returns realistic mock data berdasarkan school_code.
  Skor adalah +/- variance dari nilai baseline yang ditetapkan.

REAL API MODE (USE_MOCK=False):
  Guna EMIS_API_URL dan EMIS_API_TOKEN dari .env
  ─────────────────────────────────────────────────────
  Untuk switch ke real:
    1. Set USE_MOCK = False
    2. Set dalam .env:
         EMIS_API_URL=https://emis.moe.gov.my/api/v2
         EMIS_API_TOKEN=<token dari KPM>
    3. Uncomment blok REAL_API_CALL di bawah
"""

import random
import logging
from datetime import date
from .base_connector import BaseConnector

logger = logging.getLogger(__name__)

# ── Mock baseline scores per school type ─────────────────────────────────────
# Nilai ini adalah anggaran realistik mengikut jenis sekolah.
# Dalam real API, nilai ini akan datang terus dari EMIS.
MOCK_BASELINE = {
    "SBP":  {"academic_performance": 88, "attendance_rate": 96, "facilities_score": 90, "teacher_qualification": 98, "co_curriculum": 85},
    "MRSM": {"academic_performance": 85, "attendance_rate": 94, "facilities_score": 88, "teacher_qualification": 95, "co_curriculum": 82},
    "SMK":  {"academic_performance": 72, "attendance_rate": 88, "facilities_score": 70, "teacher_qualification": 85, "co_curriculum": 68},
    "SK":   {"academic_performance": 68, "attendance_rate": 90, "facilities_score": 65, "teacher_qualification": 82, "co_curriculum": 62},
    "SJK":  {"academic_performance": 74, "attendance_rate": 91, "facilities_score": 68, "teacher_qualification": 83, "co_curriculum": 60},
    "SKK":  {"academic_performance": 58, "attendance_rate": 82, "facilities_score": 55, "teacher_qualification": 75, "co_curriculum": 52},
}
DEFAULT_BASELINE = {"academic_performance": 70, "attendance_rate": 88, "facilities_score": 68, "teacher_qualification": 82, "co_curriculum": 65}


class EMISConnector(BaseConnector):
    SOURCE_CODE = "EMIS"
    SOURCE_NAME = "Education Management Information System (KPM)"
    USE_MOCK    = True   # ← Tukar ke False bila real API tersedia

    def pull(self, school_codes: list[str], month: int, year: int) -> list[dict]:
        if self.USE_MOCK:
            return self._mock_pull(school_codes, month, year)
        else:
            return self._real_pull(school_codes, month, year)   # noqa

    # ── MOCK DATA ─────────────────────────────────────────────────────────────
    def _mock_pull(self, school_codes: list[str], month: int, year: int) -> list[dict]:
        logger.info(f"{self._mock_label()} Pulling mock data for {len(school_codes)} schools")
        results = []
        for code in school_codes:
            school_type = self._detect_type(code)
            baseline = MOCK_BASELINE.get(school_type, DEFAULT_BASELINE)

            # Generate scores dengan variance +/- 12 untuk simulate real data variability
            rng = random.Random(hash(code + str(month) + str(year)))
            scores = {
                field: round(max(0, min(100, val + rng.uniform(-12, 12))), 1)
                for field, val in baseline.items()
            }

            results.append({
                "school_code":   code,
                "source_system": self.SOURCE_CODE,
                "pull_date":     date(year, month, 1).isoformat(),
                "data_type":     "quantitative",
                "scores":        scores,
                "raw_response":  {"mock": True, "school_code": code, "period": f"{year}-{month:02d}", "scores": scores},
            })

        logger.info(f"{self._mock_label()} Mock pull complete: {len(results)} records")
        return results

    # ── REAL API CALL (uncomment bila API tersedia) ───────────────────────────
    # def _real_pull(self, school_codes: list[str], month: int, year: int) -> list[dict]:
    #     import httpx
    #     results = []
    #     for code in school_codes:
    #         try:
    #             resp = httpx.get(
    #                 f"{self.api_url}/schools/{code}/scores",
    #                 headers=self._headers(),
    #                 params={"month": month, "year": year},
    #                 timeout=30,
    #             )
    #             resp.raise_for_status()
    #             data = resp.json()
    #             results.append({
    #                 "school_code":   code,
    #                 "source_system": self.SOURCE_CODE,
    #                 "pull_date":     date(year, month, 1).isoformat(),
    #                 "data_type":     "quantitative",
    #                 "scores":        data.get("scores", {}),
    #                 "raw_response":  data,
    #             })
    #         except Exception as e:
    #             logger.error(f"EMIS API error for {code}: {e}")
    #             results.append({"school_code": code, "error": str(e)})
    #     return results

    @staticmethod
    def _detect_type(school_code: str) -> str:
        code = school_code.upper()
        for t in ["SBP", "MRSM", "SMK", "SJK", "SKK", "SK"]:
            if t in code:
                return t
        return "SK"
