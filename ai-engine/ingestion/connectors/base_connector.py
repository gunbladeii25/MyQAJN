"""
Base Connector — interface semua API connectors perlu implement.

Untuk swap dari MOCK ke REAL API:
  1. Set USE_MOCK = False dalam connector berkenaan
  2. Set API_URL dan API_TOKEN dalam .env
  3. Uncomment blok 'REAL API CALL' dalam method pull()
"""

from abc import ABC, abstractmethod
from typing import Optional
import os


class BaseConnector(ABC):
    """
    Abstract base class untuk semua data source connectors.
    Setiap connector mewakili satu sistem sumber (EMIS, APDM, dll).
    """

    # ── Override dalam subclass ─────────────────────────────────────────────
    SOURCE_CODE: str = ""       # e.g. "EMIS"
    SOURCE_NAME: str = ""       # e.g. "Education Management Information System"
    USE_MOCK: bool = True       # MOCK=True untuk demo/pembangunan, False=Real API

    def __init__(self, api_url: Optional[str] = None, api_token: Optional[str] = None):
        self.api_url   = api_url   or os.getenv(f"{self.SOURCE_CODE}_API_URL", "")
        self.api_token = api_token or os.getenv(f"{self.SOURCE_CODE}_API_TOKEN", "")

    @abstractmethod
    def pull(self, school_codes: list[str], month: int, year: int) -> list[dict]:
        """
        Tarik data dari sumber untuk senarai sekolah.

        Returns: list of records, satu per sekolah:
        {
            "school_code": str,
            "source_system": str,
            "pull_date": "YYYY-MM-DD",
            "data_type": "quantitative" | "qualitative" | "mixed",
            "scores": {field_name: float | None},
            "raw_response": dict   # raw API response untuk audit trail
        }
        """
        ...

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _mock_label(self) -> str:
        return f"[MOCK:{self.SOURCE_CODE}]"
