"""
SK@S Connector — SKPM Kualiti@Sekolah (JN Baseline Source)

Mengembalikan skor audit JN mengikut struktur instrumen SKPM Kualiti@Sekolah:
  Aspek (cth. 1.1, 3.2.4, A5) → Domain/Standard (Kepimpinan, Kurikulum, ...)
  → jn_composite_score.

Struktur & roll-up ditakrifkan dalam ingestion/skpm_structure.py.

MOCK MODE (USE_MOCK=True):
  Menjana skor aspek realistik per jenis sekolah (seeded — konsisten
  untuk sekolah & tahun yang sama).

REAL API MODE (USE_MOCK=False):
  Perlu SKAS_API_URL dan SKAS_API_TOKEN dalam .env.
  API dijangka memulangkan skor per aspek; roll-up domain/komposit
  dikira di sini supaya logik konsisten dengan mock.
"""

import random
import logging
import zlib
from datetime import date
from .base_connector import BaseConnector
from ..skpm_structure import SKPM_DOMAINS, DOMAIN_WEIGHTS, rollup_domains, composite_from_domains

logger = logging.getLogger(__name__)

# Purata baseline (peratus) per jenis sekolah — asas penjanaan skor aspek mock.
MOCK_BASELINE_MEAN = {
    "SBP":  89, "MRSM": 85, "SMK": 71, "SK": 67, "SJK": 69, "SKK": 56,
}
DEFAULT_BASELINE_MEAN = 66

# Sedikit bias per domain supaya profil sekolah nampak realistik
# (cth. PdP & kemenjadian lazimnya lebih rendah daripada pengurusan).
MOCK_DOMAIN_BIAS = {
    "kekuatan":               +2,
    "kepimpinan":             +1,
    "pengurusan_organisasi":  +3,
    "pengurusan_kurikulum":    0,
    "pengurusan_kokurikulum": -1,
    "pengurusan_hem":         +1,
    "pdpc":                   -3,
    "kemenjadian_murid":      -4,
}


class SKASConnector(BaseConnector):
    SOURCE_CODE = "SKAS"
    SOURCE_NAME = "SKPM Kualiti@Sekolah (SK@S)"
    USE_MOCK    = True   # ← Tukar ke False bila API endpoint dikonfigurasi

    def pull(self, school_codes: list[str], month: int, year: int,
             domains: list[str] | None = None) -> list[dict]:
        # domains: subset kunci SKPM_DOMAINS untuk tarikan separa; None = semua.
        if self.USE_MOCK:
            return self._mock_pull(school_codes, month, year, domains)
        else:
            return self._real_pull(school_codes, month, year, domains)

    def _mock_pull(self, school_codes: list[str], month: int, year: int,
                   domains: list[str] | None = None) -> list[dict]:
        selected = {k: v for k, v in SKPM_DOMAINS.items() if not domains or k in domains}
        partial  = len(selected) < len(SKPM_DOMAINS)
        logger.info(
            f"{self._mock_label()} SK@S mock pull for {len(school_codes)} schools "
            f"({'domains: ' + ', '.join(selected) if partial else 'semua domain'})"
        )
        results = []
        for code in school_codes:
            school_type = self._detect_type(code)
            mean = MOCK_BASELINE_MEAN.get(school_type, DEFAULT_BASELINE_MEAN)

            # Seed stabil (crc32 — bukan hash() yang dirawak per proses Python)
            # dengan school_code + tahun + domain, supaya nilai konsisten merentas
            # restart dan tarikan separa == tarikan penuh untuk domain berkenaan.
            aspect_scores = {}
            for domain_key, spec in selected.items():
                rng  = random.Random(zlib.crc32(f"{code}|{year}|{domain_key}".encode()))
                base = mean + MOCK_DOMAIN_BIAS[domain_key]
                for aspect_code in spec["aspects"]:
                    # Sekolah tanpa asrama: tiada skor A8
                    if aspect_code == "A8" and school_type not in ("SBP", "MRSM"):
                        continue
                    aspect_scores[aspect_code] = round(
                        max(0, min(100, base + rng.uniform(-8, 8))), 1
                    )

            # Hanya domain terpilih dimasukkan — backend upsert per domain,
            # jadi domain yang tidak ditarik tidak akan disentuh dalam DB.
            domain_scores = {k: v for k, v in rollup_domains(aspect_scores).items() if k in selected}
            composite     = composite_from_domains(domain_scores)

            results.append({
                "school_code":        code,
                "source_system":      self.SOURCE_CODE,
                "pull_date":          date(year, month, 1).isoformat(),
                "data_type":          "quantitative",
                # NOTA: bagi tarikan separa, komposit ini dinormalisasi atas
                # domain terpilih SAHAJA. Backend akan kira semula komposit
                # penuh daripada JnDomainScore (baru + sedia ada) guna
                # domain_weights di bawah sebelum kemaskini School.jnAuditScore.
                "jn_composite_score": composite,
                "partial":            partial,
                "domain_weights":     DOMAIN_WEIGHTS,
                "domain_scores":      domain_scores,   # {domain: {label, komponen, score, aspect_scores}}
                "aspect_scores":      aspect_scores,   # flat: {"1.1": 78.5, ...}
                "audit_period":       f"{year}-{month:02d}",
                "raw_response":       {"mock": True, "school_code": code, "year": year,
                                       "instrument": "SKPM_KUALITI_SEKOLAH",
                                       "domains": list(selected),
                                       "aspects": aspect_scores},
            })

        logger.info(f"{self._mock_label()} SK@S pull complete: {len(results)} schools")
        return results

    # ── REAL API CALL (uncomment bila API endpoint dari JN ICT tersedia) ─────
    # Jangkaan respons API: {"aspects": {"1.1": 78.5, "3.2.4": 66.0, ...}}
    # def _real_pull(self, school_codes: list[str], month: int, year: int,
    #                domains: list[str] | None = None) -> list[dict]:
    #     import httpx
    #     selected = {k: v for k, v in SKPM_DOMAINS.items() if not domains or k in domains}
    #     wanted   = {a for spec in selected.values() for a in spec["aspects"]}
    #     partial  = len(selected) < len(SKPM_DOMAINS)
    #     results = []
    #     for code in school_codes:
    #         try:
    #             resp = httpx.get(
    #                 f"{self.api_url}/schools/{code}/skpm-scores",
    #                 headers=self._headers(),
    #                 params={"year": year},
    #                 timeout=30,
    #             )
    #             resp.raise_for_status()
    #             data = resp.json()
    #             aspect_scores = {a: v for a, v in data.get("aspects", {}).items() if a in wanted}
    #             domain_scores = {k: v for k, v in rollup_domains(aspect_scores).items() if k in selected}
    #             composite     = composite_from_domains(domain_scores)
    #             results.append({
    #                 "school_code":        code,
    #                 "source_system":      self.SOURCE_CODE,
    #                 "pull_date":          date(year, month, 1).isoformat(),
    #                 "data_type":          "quantitative",
    #                 "jn_composite_score": composite,
    #                 "partial":            partial,
    #                 "domain_weights":     DOMAIN_WEIGHTS,
    #                 "domain_scores":      domain_scores,
    #                 "aspect_scores":      aspect_scores,
    #                 "audit_period":       f"{year}-{month:02d}",
    #                 "raw_response":       data,
    #             })
    #         except Exception as e:
    #             logger.error(f"SK@S API error for {code}: {e}")
    #             results.append({"school_code": code, "error": str(e)})
    #     return results

    @staticmethod
    def _detect_type(school_code: str) -> str:
        code = school_code.upper()
        for t in ["SBP", "MRSM", "SMK", "SJK", "SKK", "SK"]:
            if t in code:
                return t
        return "SK"
