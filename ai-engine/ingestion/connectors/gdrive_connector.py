"""
Google Drive Connector — Pemeriksaan JN Documents (JN Baseline Source)

Dokumen Pemeriksaan JN sebenar ialah SYOR — pernyataan kualitatif/kuantitatif
yang telah di-endorse oleh YB Menteri. Setiap baris syor menyentuh standard
SKPM tertentu; Agent 0 + model AI menganalisis pernyataan dan menukarkannya
kepada skor numerik per standard. Oleh itu satu dokumen lazimnya HANYA
meliputi sebahagian standard (tarikan separa) — backend akan gabungkan
dengan baris JnDomainScore sedia ada dan kira semula komposit.

MOCK MODE (USE_MOCK=True):
  Mensimulasikan syor: subset standard SKPM (3–5) per sekolah, dengan
  pernyataan syor mock dan skor hasil "AI conversion" (seed stabil crc32).

REAL API MODE (USE_MOCK=False):
  Requirements:
  1. Set GDRIVE_FOLDER_ID in .env (the shared Drive folder ID)
  2. Set GDRIVE_SERVICE_ACCOUNT_JSON in .env (path to service account key file)
  3. Install google-api-python-client: pip install google-api-python-client google-auth
  4. Share the Drive folder with the service account email

  File naming convention expected: JN_<school_code>_<YYYY>.pdf
  e.g. JN_SKB001_2026.pdf, JN_SMK001_2026.pdf
"""

import os
import random
import logging
import zlib
from datetime import date
from .base_connector import BaseConnector
from ..skpm_structure import SKPM_DOMAINS, DOMAIN_WEIGHTS

logger = logging.getLogger(__name__)

# Purata skor pemeriksaan per jenis sekolah (asas penjanaan skor mock)
MOCK_INSPECTION_MEAN = {
    "SBP": 88, "MRSM": 84, "SMK": 70, "SK": 65, "SJK": 68, "SKK": 55,
}
DEFAULT_INSPECTION_MEAN = 65

# Templat pernyataan syor mock per domain SKPM (simulasi output analisis AI)
MOCK_SYOR_TEMPLATES = {
    "kekuatan":               "Syor: Naik taraf prasarana dan sumber sekolah perlu diberi keutamaan bagi menyokong persekitaran pembelajaran kondusif.",
    "kepimpinan":             "Syor: PGB perlu memperkukuh peranan sebagai peneraju instruksional dengan pemantauan berkala.",
    "pengurusan_organisasi":  "Syor: Pengurusan sumber manusia dan kewangan sekolah hendaklah diperkemas selaras dengan tatacara semasa.",
    "pengurusan_kurikulum":   "Syor: Pelaksanaan kurikulum perlu dipantau melalui penyeliaan PdP yang berstruktur dan konsisten.",
    "pengurusan_kokurikulum": "Syor: Penyertaan murid dalam aktiviti kokurikulum perlu diperluas ke peringkat daerah dan negeri.",
    "pengurusan_hem":         "Syor: Pengurusan disiplin dan kebajikan murid perlu diperkukuh dengan sistem intervensi awal.",
    "pdpc":                   "Syor: Kualiti pembelajaran dan pemudahcaraan guru perlu ditingkatkan melalui bimbingan instruksional.",
    "kemenjadian_murid":      "Syor: Program peningkatan kemenjadian murid dalam akademik dan sahsiah perlu dilaksana secara bersepadu.",
}

# ── Tema pemeriksaan JN (mock file listing) ─────────────────────────────────
MOCK_INSPECTION_THEMES = [
    {"theme": "PAJSK",          "file": "Pemeriksaan PAJSK {year}.docx",
     "desc": "Pemeriksaan Pendidikan Jasmani & Sukan"},
    {"theme": "Kurikulum",      "file": "Pemeriksaan Kurikulum {year}.docx",
     "desc": "Pemeriksaan Pelaksanaan Kurikulum"},
    {"theme": "PPD",            "file": "Pemeriksaan PPD {year}.docx",
     "desc": "Pemeriksaan Pejabat Pendidikan Daerah"},
    {"theme": "Kokurikulum",    "file": "Pemeriksaan Kokurikulum {year}.docx",
     "desc": "Pemeriksaan Aktiviti Kokurikulum"},
]


class GDriveConnector(BaseConnector):
    SOURCE_CODE = "PEMERIKSAAN_JN"
    SOURCE_NAME = "Pemeriksaan JN — Google Drive"
    USE_MOCK    = True   # ← Tukar ke False bila Google Drive API dikonfigurasi

    def __init__(self):
        super().__init__()
        self.folder_id   = os.getenv("GDRIVE_FOLDER_ID", "")
        self.sa_key_path = os.getenv("GDRIVE_SERVICE_ACCOUNT_JSON", "")

    def pull(self, school_codes: list[str], month: int, year: int,
             domains: list[str] = None, file_ids: list[str] = None) -> list[dict]:
        # If file_ids contain mock IDs, force MOCK mode
        is_mock_file = file_ids and any(fid.startswith('mock_') for fid in file_ids)
        # Auto-switch: REAL mode only if GDrive configured AND not mock file
        skip_real = os.getenv("GDRIVE_SKIP_REAL", "") == "1"
        if self.folder_id and self.sa_key_path and not skip_real and not is_mock_file:
            logger.info("GDrive REAL mode: tarik & parse bulk dokumen dari Google Drive"
                        + (f" (filtered to {len(file_ids)} file(s))" if file_ids else ""))
            return self._real_pull(school_codes, month, year, file_ids=file_ids)
        logger.info("GDrive MOCK mode" + (" (mock files selected)" if is_mock_file else ""))
        return self._mock_pull(school_codes, month, year)

    def _mock_pull(self, school_codes: list[str], month: int, year: int) -> list[dict]:
        """
        MOCK: Simulasi bulk Pemeriksaan JN — dokumen bertema meliputi
        PELBAGAI sekolah. Agent 0 akan "baca" kandungan dan kenal pasti
        sekolah secara dinamik (disimulasikan dengan seed stabil).
        """
        if not school_codes:
            return []

        # Pilih 1-2 tema rawak untuk liputan mock
        rng_theme = random.Random(zlib.crc32(f"THEME|{year}|{month}".encode()))
        num_themes = min(2, len(MOCK_INSPECTION_THEMES))
        selected_themes = rng_theme.sample(MOCK_INSPECTION_THEMES, num_themes)

        # Agihkan sekolah kepada tema (round-robin)
        theme_buckets = {t["theme"]: [] for t in selected_themes}
        for i, code in enumerate(school_codes):
            theme = selected_themes[i % num_themes]
            theme_buckets[theme["theme"]].append(code)

        all_domains = list(SKPM_DOMAINS)
        results = []
        inspection_theme = selected_themes[0]["theme"]  # primary theme for logging

        for theme_info in selected_themes:
            theme_name = theme_info["theme"]
            theme_codes = theme_buckets[theme_name]
            if not theme_codes:
                continue

            source_file = theme_info["file"].format(year=year)
            logger.info(f"{self._mock_label()} Bulk inspection '{theme_name}': "
                        f"{len(theme_codes)} schools in {source_file}")

            for code in theme_codes:
                school_type = self._detect_type(code)
                mean = MOCK_INSPECTION_MEAN.get(school_type, DEFAULT_INSPECTION_MEAN)

                # Syor subset: seed stabil ikut (code, year, theme) —
                # dokumen sama sentiasa hasilkan liputan sama.
                doc_rng = random.Random(zlib.crc32(f"{code}|{year}|{theme_name}|SYOR".encode()))
                covered = sorted(doc_rng.sample(all_domains, doc_rng.randint(2, 4)),
                                 key=all_domains.index)

                domain_scores = {}
                syor_lines = [f"=== {theme_info['desc']} ===\n"
                              f"Tema Pemeriksaan: {theme_name}\n"
                              f"Kod Sekolah: {code}\n"]

                for dom in covered:
                    rng = random.Random(zlib.crc32(f"{code}|{year}|{theme_name}|{dom}|SYOR".encode()))
                    score = round(max(0, min(100, mean + rng.uniform(-8, 8))), 1)
                    domain_scores[dom] = {
                        "label":    SKPM_DOMAINS[dom]["label"],
                        "komponen": SKPM_DOMAINS[dom]["komponen"],
                        "score":    score,
                    }
                    syor_lines.append(f"[{SKPM_DOMAINS[dom]['label']}] {MOCK_SYOR_TEMPLATES[dom]}")

                total_w = sum(DOMAIN_WEIGHTS[d] for d in covered)
                composite = round(
                    sum(domain_scores[d]["score"] * DOMAIN_WEIGHTS[d] for d in covered) / total_w, 2
                )

                results.append({
                    "school_code":        code,
                    "source_system":      self.SOURCE_CODE,
                    "pull_date":          date(year, month, 1).isoformat(),
                    "data_type":          "mixed",
                    "jn_composite_score": composite,
                    "partial":            len(covered) < len(all_domains),
                    "domain_weights":     DOMAIN_WEIGHTS,
                    "domain_scores":      domain_scores,
                    "qualitative_text":   "\n".join(syor_lines),
                    "audit_period":       f"{year}-{month:02d}",
                    "source_file_name":   source_file,
                    "inspection_theme":   theme_name,
                    "conversion_method":  "ai_converted",
                    "agent0_confidence":  round(doc_rng.uniform(0.82, 0.95), 3),
                    "raw_response": {
                        "mock": True, "file": source_file,
                        "inspection_theme": theme_name,
                        "syor_covered": covered,
                        "scores": {k: d["score"] for k, d in domain_scores.items()},
                    },
                })

        return results

    # ── REAL GOOGLE DRIVE API ─────────────────────────────────────────────────
    # [REVAMPED] Cari SEMUA fail dalam folder yang mengandungi tahun →
    # muat turun → Agent 0 run_bulk() proses semua sekolah dalam fail →
    # tapis ikut school_codes yang diminta.
    # Tiada lagi kebergantungan pada konvensyen nama JN_<KOD>_<TAHUN>.pdf.
    # Dokumen dinamakan mengikut tema: "Pemeriksaan PAJSK 2026.docx", dsb.
    def _real_pull(self, school_codes: list[str], month: int, year: int,
                    file_ids: list[str] = None) -> list[dict]:
        from googleapiclient.discovery import build
        from google.oauth2 import service_account
        import tempfile
        from agents import agent_0
        from ..mapping_engine import extracted_to_skpm_domains

        SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
        creds = service_account.Credentials.from_service_account_file(self.sa_key_path, scopes=SCOPES)
        service = build('drive', 'v3', credentials=creds)

        # ── Step 1: Cari SEMUA fail dalam folder yang mengandungi tahun ──────
        query = (f"'{self.folder_id}' in parents and trashed = false "
                 f"and name contains '{year}'")
        resp = service.files().list(q=query, fields="files(id,name,mimeType)").execute()
        all_files = resp.get('files', [])

        if not all_files:
            logger.warning(f"No GDrive files found in folder for year {year}")
            return [{"school_code": code,
                     "error": f"Tiada dokumen Pemeriksaan JN ditemui untuk tahun {year}"}
                    for code in school_codes]

        logger.info(f"GDrive REAL: found {len(all_files)} file(s) — "
                    f"processing with bulk Agent 0...")

        # ── Filter to selected files if file_ids provided ──────────────────
        if file_ids:
            all_files = [f for f in all_files if f['id'] in file_ids]
            if not all_files:
                logger.warning(f"No matching files for IDs: {file_ids}")
                return [{"school_code": code,
                         "error": "Fail yang dipilih tidak dijumpai dalam Google Drive."}
                        for code in school_codes]
            logger.info(f"  Filtered to {len(all_files)} selected file(s)")

        # ── Step 2: Proses setiap fail dengan Agent 0 run_bulk() ──────────────
        # run_bulk() akan kenal pasti SEMUA sekolah dari kandungan fail.
        all_results = []
        processed_schools = set()

        for file_meta in all_files:
            file_name = file_meta['name']
            ext = file_name.rsplit('.', 1)[-1].lower() if '.' in file_name else 'docx'
            logger.info(f"  → Processing: {file_name}")

            try:
                content = service.files().get_media(fileId=file_meta['id']).execute()

                with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
                    tmp.write(content)
                    tmp_path = tmp.name

                try:
                    # Gunakan run_bulk untuk ekstrak SEMUA sekolah dari fail
                    bulk_results = agent_0.run_bulk(
                        tmp_path, ext,
                        school_codes_filter=school_codes,  # tapis hanya sekolah diminta
                        source_metadata={"source_file": file_name},
                    )
                finally:
                    try:
                        import os as _os
                        _os.unlink(tmp_path)
                    except OSError:
                        pass

                if not bulk_results:
                    logger.warning(f"    ⚠ No schools detected in {file_name} — "
                                   "trying fallback single-school parse...")
                    # Fallback: cuba parse sebagai single-school document
                    try:
                        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp2:
                            tmp2.write(content)
                            tmp2_path = tmp2.name
                        a0 = agent_0.run(tmp2_path, ext, {"school_code": school_codes[0] if school_codes else "UNKNOWN"})
                        try:
                            import os as _os
                            _os.unlink(tmp2_path)
                        except OSError:
                            pass
                        # Assign to first school in filter
                        if school_codes:
                            code = school_codes[0]
                            domain_scores, composite, partial = extracted_to_skpm_domains(
                                a0.get("extracted_scores", {})
                            )
                            bulk_results = [{
                                "school_code": code,
                                "extracted_scores": a0.get("extracted_scores", {}),
                                "qualitative_text": a0.get("qualitative_text"),
                                "data_type": a0.get("data_type", "mixed"),
                                "conversion_method": a0.get("conversion_method", "ai_converted"),
                                "agent0_confidence": a0.get("agent0_confidence", 0.0),
                            }]
                    except Exception as fallback_err:
                        logger.error(f"    Fallback also failed: {fallback_err}")
                        continue

                # ── Map Agent 0 results → JN baseline records ─────────────────
                for a0_rec in bulk_results:
                    code = a0_rec.get("school_code", "UNKNOWN")
                    if code == "UNKNOWN" or code in processed_schools:
                        continue
                    processed_schools.add(code)

                    domain_scores, composite, partial = extracted_to_skpm_domains(
                        a0_rec.get("extracted_scores", {})
                    )

                    all_results.append({
                        "school_code":        code,
                        "source_system":      self.SOURCE_CODE,
                        "pull_date":          date(year, month, 1).isoformat(),
                        "data_type":          a0_rec.get("data_type", "mixed"),
                        "jn_composite_score": composite,
                        "partial":            partial,
                        "domain_weights":     DOMAIN_WEIGHTS,
                        "domain_scores":      domain_scores,
                        "qualitative_text":   a0_rec.get("qualitative_text"),
                        "audit_period":       f"{year}-{month:02d}",
                        "source_file_name":   file_name,
                        "conversion_method":  a0_rec.get("conversion_method", "ai_converted"),
                        "agent0_confidence":  a0_rec.get("agent0_confidence", 0.0),
                        "raw_response":       {"file": file_name, "drive_file_id": file_meta['id']},
                    })
                    logger.info(f"    ✓ {code}: composite={composite}, "
                                f"domains={len(domain_scores)}")

            except Exception as e:
                logger.error(f"  ✗ Error processing {file_name}: {e}")
                continue

        # ── Step 3: Schools yang tak dijumpai dalam mana-mana fail ─────────────
        for code in school_codes:
            if code not in processed_schools:
                all_results.append({
                    "school_code": code,
                    "error": (f"Kod sekolah {code} tidak dijumpai dalam mana-mana "
                              f"dokumen Pemeriksaan JN untuk tahun {year}. "
                              f"Semak folder Google Drive.")
                })

        logger.info(f"GDrive REAL pull complete: {len(processed_schools)}/{len(school_codes)} "
                     f"schools found across {len(all_files)} file(s)")
        return all_results

    @staticmethod
    def _detect_type(school_code: str) -> str:
        code = school_code.upper()
        for t in ["SBP", "MRSM", "SMK", "SJK", "SKK", "SK"]:
            if t in code:
                return t
        return "SK"

    @classmethod
    def list_files(cls, year: int = None) -> list[dict]:
        """
        List files from GDrive. Uses REAL if configured, MOCK as fallback.
        """
        folder_id   = os.getenv("GDRIVE_FOLDER_ID", "")
        sa_key_path = os.getenv("GDRIVE_SERVICE_ACCOUNT_JSON", "")

        # Skip REAL mode if GDrive API is timing out (set GDRIVE_SKIP_REAL=1)
        skip_real = os.getenv("GDRIVE_SKIP_REAL", "") == "1"
        if folder_id and sa_key_path and not skip_real:
            try:
                return cls._real_list_files(folder_id, sa_key_path, year)
            except Exception as e:
                logger.warning(f"GDrive REAL listing failed ({e}), falling back to MOCK")
        logger.info("GDrive listing: using MOCK mode")
        return cls._mock_list_files(year)

    @staticmethod
    def _real_list_files(folder_id: str, sa_key_path: str, year: int = None) -> list[dict]:
        """REAL: List files in GDrive folder using service account (5s timeout)."""
        import signal
        from googleapiclient.discovery import build
        from google.oauth2 import service_account

        SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
        creds = service_account.Credentials.from_service_account_file(sa_key_path, scopes=SCOPES)
        service = build('drive', 'v3', credentials=creds, cache_discovery=False)

        query = f"'{folder_id}' in parents and trashed = false"
        if year:
            query += f" and name contains '{year}'"

        try:
            resp = service.files().list(
                q=query,
                fields="files(id,name,mimeType,size,modifiedTime,webViewLink)",
                orderBy="modifiedTime desc",
            ).execute(num_retries=1)
            files = resp.get('files', [])

            # Tambah metadata: kenal pasti tema dari nama fail
            result = []
            for f in files:
                theme = _detect_theme_from_filename(f.get('name', ''))
                result.append({
                    "id":           f.get('id'),
                    "name":         f.get('name'),
                    "mimeType":     f.get('mimeType'),
                    "size":         int(f.get('size', 0)),
                    "modifiedTime": f.get('modifiedTime'),
                    "webViewLink":  f.get('webViewLink'),
                    "theme":        theme,
                    "isDocx":       f.get('mimeType', '').endswith('document') or
                                    f.get('name', '').lower().endswith('.docx'),
                })

            return result
        except Exception as e:
            logger.error(f"GDrive list_files error: {e}")
            return []

    @staticmethod
    def _mock_list_files(year: int = None) -> list[dict]:
        """MOCK: Simulate file listing with themed inspection documents."""
        import random, zlib
        if not year:
            from datetime import date
            year = date.today().year

        rng = random.Random(zlib.crc32(f"GDRIVE_LIST|{year}".encode()))
        num_files = rng.randint(2, 4)
        selected = rng.sample(MOCK_INSPECTION_THEMES, min(num_files, len(MOCK_INSPECTION_THEMES)))

        files = []
        for i, theme in enumerate(selected):
            file_name = theme["file"].format(year=year)
            files.append({
                "id":           f"mock_file_{i}_{year}",
                "name":         file_name,
                "mimeType":     "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "size":         rng.randint(15000, 85000),
                "modifiedTime": f"{year}-07-12T08:00:00Z",
                "webViewLink":  f"https://drive.google.com/file/d/mock_{i}/view",
                "theme":        theme["theme"],
                "isDocx":       True,
            })

        return files


# ── Module-level helper ──────────────────────────────────────────────────────
def _detect_theme_from_filename(filename: str) -> str:
    """Cuba detect tema pemeriksaan dari nama fail."""
    name_upper = filename.upper()
    theme_keywords = {
        "PAJSK":       "PAJSK",
        "KURIKULUM":   "Kurikulum",
        "PPD":         "PPD",
        "KOKURIKULUM": "Kokurikulum",
        "HEM":         "HEM",
        "PRASARANA":   "Prasarana",
        "PEMERIKSAAN": "Umum",  # fallback
    }
    for keyword, theme in theme_keywords.items():
        if keyword in name_upper:
            return theme
    return "Umum"
