import os
import json
import logging
from datetime import date
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel
from typing import Optional, List
import tempfile

from agents import agent_a, agent_b, agent_c
from agents import agent_0
from ingestion.connectors.emis_connector import EMISConnector
from ingestion.connectors.jn_connector import JNConnector
from ingestion.connectors.skas_connector import SKASConnector
from ingestion.connectors.skpk_connector import SKPKConnector
from ingestion.connectors.gdrive_connector import GDriveConnector
from ingestion.mapping_engine import map_and_score
from ingestion.skpm_structure import SKPM_DOMAINS, DOMAIN_WEIGHTS
from ingestion.mapping_engine import extracted_to_skpm_domains
from ingestion.scheduler import get_scheduler, scheduler_status, monthly_pull_job

logger = logging.getLogger(__name__)

# ── Scheduler lifecycle ────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = get_scheduler()
    if scheduler:
        try:
            scheduler.start()
            logger.info("[Scheduler] Started")
        except Exception as e:
            logger.warning(f"[Scheduler] Could not start: {e}")
    yield
    if scheduler and scheduler.running:
        scheduler.shutdown()

app = FastAPI(title="MyQA@JN AI Engine", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ═══════════════════════════════════════════════════════════════════════════════
# PYDANTIC MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class PipelinePayload(BaseModel):
    school_id: str
    school_name: str
    operational_score: float
    jn_audit_score: Optional[float] = None
    incident_text: str
    integrity_risk_index: float = 0.0
    canteen_hygiene_score: Optional[float] = None
    last_audit_date: Optional[str] = None
    emis_access_suspended: bool = False
    repeat_count: int = 0
    jn_domain_scores: Optional[dict] = None  # {domain: skor} — snapshot JnDomainScore terkini sekolah
    domain_di: Optional[dict] = None         # {domain: {jn_score, operational_score, di, ...}} — dari kelulusan ingestion (dua belah)

class JNBaselinePullRequest(BaseModel):
    source_code: str                  # "SKAS" | "SKPK" | "PEMERIKSAAN_JN"
    school_codes: List[str]
    month: Optional[int] = None
    year: Optional[int] = None
    domains: Optional[List[str]] = None  # SKAS sahaja: subset kunci SKPM_DOMAINS; None/[] = semua standard
    gdrive_file_ids: Optional[List[str]] = None  # PEMERIKSAAN_JN: filter file spesifik

class APIPullRequest(BaseModel):
    source_code: str                  # "EMIS" | "APDM"
    school_codes: List[str]
    jn_scores: Optional[dict] = None  # {school_code: jn_audit_score} — dari DB sekolah
    jn_domain_scores: Optional[dict] = None  # {school_code: {domain: skor}} — JnDomainScore terkini, untuk DI per standard
    field_mappings: Optional[dict] = None
    month: Optional[int] = None
    year: Optional[int] = None

class IngestResult(BaseModel):
    school_code: str
    source_system: str
    extracted_scores: dict
    mapped_scores: dict
    composite_operational_score: Optional[float]
    jn_audit_score: Optional[float]
    discrepancy_index: Optional[float]
    di_classification: Optional[str]
    alert_level: Optional[str]
    data_type: str
    agent0_confidence: float
    conversion_method: str

# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/ai/health")
def health():
    return {"status": "ok", "service": "MyQA@JN AI Engine", "version": "2.0.0"}

# ═══════════════════════════════════════════════════════════════════════════════
# GDRIVE FILE LISTING (for Pemeriksaan JN file browser)
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/ai/gdrive/files")
def list_gdrive_files(year: Optional[int] = None):
    """
    Senaraikan fail dalam folder Google Drive Pemeriksaan JN.
    Frontend guna ini untuk papar senarai fail sebelum user klik "Tarik Syor".
    """
    try:
        files = GDriveConnector.list_files(year)
        return {"files": files, "total": len(files)}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"GDrive listing error: {str(e)}")

# ═══════════════════════════════════════════════════════════════════════════════
# MAPPING PREVIEW — Fasa B: tunjuk compatibility outsource ↔ JN baseline
# ═══════════════════════════════════════════════════════════════════════════════

class MappingPreviewRequest(BaseModel):
    source_code: str           # "EMIS" | "APDM" | "JPN_REPORT" etc
    school_codes: List[str]
    jn_domain_scores: Optional[dict] = None  # {school_code: {domain: skor}} — dari DB
    field_mappings: Optional[dict] = None    # override dari data_source

@app.post("/ai/ingest/mapping-preview")
def mapping_preview(req: MappingPreviewRequest):
    """
    Preview: untuk setiap sekolah, tunjuk:
      - Standard JN mana yang ADA baseline (dari Fasa A)
      - Field outsource mana yang map ke standard mana
      - Status coverage: hijau (both), kuning (partial), merah (no JN baseline)
    """
    from ingestion.mapping_engine import DEFAULT_MAPPINGS as MAPPINGS

    jn_domains = req.jn_domain_scores or {}
    mappings = {**MAPPINGS, **(req.field_mappings or {})}

    # Kumpul semua jn_dimension yang ada dalam mapping
    mapped_dimensions = {}
    for field, cfg in mappings.items():
        dim = cfg["jn_dimension"]
        if dim not in mapped_dimensions:
            mapped_dimensions[dim] = []
        mapped_dimensions[dim].append({
            "field": field,
            "weight": cfg.get("weight", 0.10),
        })

    # Untuk setiap sekolah, semak baseline coverage
    schools_preview = []
    for code in req.school_codes:
        jn_baseline = jn_domains.get(code, {})
        covered_domains = list(jn_baseline.keys()) if jn_baseline else []

        dimensions_detail = []
        total_mapped = 0
        covered_count = 0

        for dim, fields in mapped_dimensions.items():
            has_baseline = dim in covered_domains
            jn_score = jn_baseline.get(dim) if has_baseline else None
            total_weight = sum(f["weight"] for f in fields)

            total_mapped += 1
            if has_baseline:
                covered_count += 1

            dimensions_detail.append({
                "dimension": dim,
                "dimension_label": SKPM_DOMAINS.get(dim, {}).get("label", dim),
                "has_jn_baseline": has_baseline,
                "jn_score": jn_score,
                "outsource_fields": [f["field"] for f in fields],
                "total_weight": round(total_weight, 2),
            })

        coverage_pct = round(covered_count / total_mapped * 100) if total_mapped > 0 else 0

        schools_preview.append({
            "school_code": code,
            "jn_domains_available": covered_domains,
            "jn_domain_count": len(covered_domains),
            "mapped_dimensions": dimensions_detail,
            "coverage_pct": coverage_pct,
            "coverage_status": "good" if coverage_pct >= 60 else "partial" if coverage_pct >= 30 else "low",
        })

    return {
        "source_code": req.source_code,
        "source_label": {"EMIS": "EMIS", "APDM": "APDM"}.get(req.source_code, req.source_code),
        "schools": schools_preview,
        "mapped_dimension_count": len(mapped_dimensions),
    }

# ═══════════════════════════════════════════════════════════════════════════════
# CORE AI PIPELINE (sedia ada)
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/ai/pipeline")
def run_pipeline(payload: PipelinePayload):
    data = payload.model_dump()
    try:
        out_a = agent_a.run(data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent A error: {str(e)}")
    try:
        out_b = agent_b.run(data, out_a)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent B error: {str(e)}")
    try:
        out_c = agent_c.run(data, out_a, out_b)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent C error: {str(e)}")
    return {"agent_a": out_a, "agent_b": out_b, "agent_c": out_c}

@app.post("/ai/agent-a")
def run_agent_a(payload: PipelinePayload):
    return agent_a.run(payload.model_dump())

@app.post("/ai/agent-b")
def run_agent_b(payload: PipelinePayload):
    out_a = agent_a.run(payload.model_dump())
    return agent_b.run(payload.model_dump(), out_a)

@app.post("/ai/agent-c")
def run_agent_c(payload: PipelinePayload):
    data = payload.model_dump()
    out_a = agent_a.run(data)
    out_b = agent_b.run(data, out_a)
    return agent_c.run(data, out_a, out_b)

# ═══════════════════════════════════════════════════════════════════════════════
# INGESTION — API PULL
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/ai/ingest/api")
def ingest_from_api(req: APIPullRequest):
    """
    Pull data dari API connector (EMIS/APDM/dll), apply mapping engine,
    compute DI vs JN audit score.

    req.jn_scores = {school_code: jn_audit_score} — hantar dari backend (ambil dari DB)
    req.field_mappings = optional override dari data_source.field_mappings
    """
    now = date.today()
    month = req.month or now.month
    year  = req.year  or now.year

    # ── Select connector ──────────────────────────────────────────────────────
    connector_map = {
        "EMIS": EMISConnector,
        "APDM": EMISConnector,   # reuse EMIS mock structure for APDM (same fields)
        "SKAS": EMISConnector,
        "SKPK": EMISConnector,
    }
    ConnectorClass = connector_map.get(req.source_code.upper())
    if not ConnectorClass:
        raise HTTPException(status_code=400, detail=f"Connector '{req.source_code}' tidak disokong")

    connector = ConnectorClass()
    jn_conn   = JNConnector()

    # ── Pull external data ────────────────────────────────────────────────────
    try:
        ext_records = connector.pull(req.school_codes, month, year)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Connector error: {str(e)}")

    # ── Pull JN data (mock atau dari req.jn_scores) ───────────────────────────
    jn_records_raw = req.jn_scores or {}
    if not jn_records_raw:
        # Jika backend tidak hantar JN scores, pull dari JN connector (mock)
        jn_pulled = jn_conn.pull(req.school_codes, month, year)
        jn_records_raw = {r["school_code"]: r.get("composite_jn_score") for r in jn_pulled}

    # ── Map + compute DI for each school ─────────────────────────────────────
    results = []
    for ext in ext_records:
        school_code = ext["school_code"]
        if "error" in ext:
            results.append({"school_code": school_code, "error": ext["error"]})
            continue

        jn_score = jn_records_raw.get(school_code)
        jn_domains = (req.jn_domain_scores or {}).get(school_code)
        mapping  = map_and_score(ext["scores"], jn_score, req.field_mappings, jn_domains)

        results.append({
            "school_code":                school_code,
            "source_system":              req.source_code,
            "extracted_scores":           ext["scores"],
            "mapped_scores":              mapping["mapped_scores"],
            "composite_operational_score": mapping["composite_operational_score"],
            "jn_audit_score":             jn_score,
            "discrepancy_index":          mapping["discrepancy_index"],
            "di_classification":          mapping["di_classification"],
            "alert_level":                mapping["alert_level"],
            "domain_di":                  mapping["domain_di"],
            "data_type":                  ext.get("data_type", "quantitative"),
            "agent0_confidence":          0.90,   # high confidence for structured API data
            "conversion_method":          "direct",
            "pull_date":                  ext.get("pull_date", now.isoformat()),
            "raw_response":               ext.get("raw_response", {}),
        })

    return {"source": req.source_code, "month": month, "year": year, "records": results}

# ═══════════════════════════════════════════════════════════════════════════════
# INGESTION — JN BASELINE PULL (SKAS / SKPK / Pemeriksaan JN via GDrive)
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/ai/ingest/jn-baseline")
def ingest_jn_baseline(req: JNBaselinePullRequest):
    """
    Pull JN audit scores dari sumber JN baseline (SK@S / SKPK / Google Drive).
    Mengembalikan jn_composite_score per sekolah.
    Backend akan kemaskini School.jnAuditScore dengan nilai ini.
    Tiada IngestionRecord dibuat — ia adalah kemaskini baseline, bukan perbandingan.
    """
    now = date.today()
    month = req.month or now.month
    year  = req.year  or now.year

    connector_map = {
        "SKAS":           SKASConnector,
        "SKPK":           SKPKConnector,
        "PEMERIKSAAN_JN": GDriveConnector,
    }
    ConnectorClass = connector_map.get(req.source_code.upper())
    if not ConnectorClass:
        raise HTTPException(status_code=400, detail=f"JN baseline connector '{req.source_code}' tidak disokong. Guna: SKAS, SKPK, PEMERIKSAAN_JN")

    connector = ConnectorClass()
    try:
        if req.source_code.upper() == "SKAS":
            domains = req.domains or None
            if domains:
                unknown = [d for d in domains if d not in SKPM_DOMAINS]
                if unknown:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Domain SKPM tidak dikenali: {', '.join(unknown)}. Sah: {', '.join(SKPM_DOMAINS)}",
                    )
            records = connector.pull(req.school_codes, month, year, domains=domains)
        elif req.source_code.upper() == "PEMERIKSAAN_JN":
            records = connector.pull(req.school_codes, month, year,
                                     file_ids=req.gdrive_file_ids)
        else:
            records = connector.pull(req.school_codes, month, year)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"JN baseline connector error: {str(e)}")

    return {
        "source":  req.source_code,
        "month":   month,
        "year":    year,
        "domains": req.domains or None,
        "records": records,
    }

# ═══════════════════════════════════════════════════════════════════════════════
# INGESTION — JN BASELINE DOCUMENT UPLOAD (syor Pemeriksaan JN, manual)
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/ai/ingest/jn-document")
async def ingest_jn_document(
    file: UploadFile = File(...),
    school_codes: str = Form(...),      # JSON array string: '["SMK001"]'
):
    """
    Muat naik manual dokumen syor Pemeriksaan JN (fallback kepada tarikan
    Google Drive). Menyokong dokumen BULK (satu fail → pelbagai sekolah)
    melalui Agent 0 run_bulk().

    Untuk satu sekolah sahaja: fallback kepada run() single-mode.
    """
    codes = json.loads(school_codes)

    filename = file.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"
    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        # Cuba run_bulk dulu — Agent 0 akan detect sekolah secara dinamik
        bulk_results = agent_0.run_bulk(
            tmp_path, ext,
            school_codes_filter=codes if len(codes) > 1 else None,
            source_metadata={"source_file": filename},
        )

        # Jika run_bulk tak jumpa sekolah (atau single school), fallback ke run()
        if not bulk_results and codes:
            logger.info(f"run_bulk returned empty — falling back to single parse for {codes[0]}")
            a0_single = agent_0.run(tmp_path, ext, {"school_code": codes[0]})
            domain_scores, composite, partial = extracted_to_skpm_domains(
                a0_single.get("extracted_scores", {})
            )
            bulk_results = [{
                "school_code": codes[0],
                "extracted_scores": a0_single.get("extracted_scores", {}),
                "qualitative_text": a0_single.get("qualitative_text"),
                "data_type": a0_single.get("data_type", "mixed"),
                "conversion_method": a0_single.get("conversion_method", "ai_converted"),
                "agent0_confidence": a0_single.get("agent0_confidence", 0.0),
            }]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent 0 error: {str(e)}")
    finally:
        import os as _os
        try: _os.unlink(tmp_path)
        except: pass

    # Bina rekod per sekolah dari hasil bulk/single
    results = []
    detected_codes = set()
    for a0_rec in bulk_results:
        code = a0_rec.get("school_code", "UNKNOWN")
        if code == "UNKNOWN":
            continue
        detected_codes.add(code)

        domain_scores, composite, partial = extracted_to_skpm_domains(
            a0_rec.get("extracted_scores", {})
        )

        results.append({
            "school_code":        code,
            "source_system":      "PEMERIKSAAN_JN",
            "pull_date":          date.today().isoformat(),
            "data_type":          a0_rec.get("data_type", "mixed"),
            "jn_composite_score": composite,
            "partial":            partial,
            "domain_weights":     DOMAIN_WEIGHTS,
            "domain_scores":      domain_scores,
            "qualitative_text":   a0_rec.get("qualitative_text"),
            "audit_period":       date.today().isoformat()[:7],
            "source_file_name":   filename,
            "conversion_method":  a0_rec.get("conversion_method", "ai_converted"),
            "agent0_confidence":  a0_rec.get("agent0_confidence", 0.0),
        })

    # Schools yang diminta tapi tak dijumpai dalam dokumen
    for code in codes:
        if code not in detected_codes:
            results.append({
                "school_code": code,
                "error": f"Kod sekolah {code} tidak dijumpai dalam kandungan dokumen.",
            })

    return {
        "source": "PEMERIKSAAN_JN",
        "file": filename,
        "document_preview": (bulk_results[0].get("raw_text_preview", "")
                             if bulk_results else ""),
        "records": results,
    }

# ═══════════════════════════════════════════════════════════════════════════════
# INGESTION — DOCUMENT UPLOAD (Agent 0)
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/ai/ingest/document")
async def ingest_document(
    file: UploadFile = File(...),
    school_codes: str = Form(...),      # JSON array string: '["SMK001","SK002"]'
    jn_scores: str = Form("{}"),        # JSON: '{"SMK001": 72.5}'
    jn_domain_scores: str = Form("{}"), # JSON: '{"SMK001": {"kekuatan": 89.7, ...}}'
    field_mappings: str = Form("{}"),
    source_system: str = Form("JPN_REPORT"),
):
    """
    Upload dokumen (PDF/DOCX/Excel) → Agent 0 parse + AI convert kualitatif →
    mapping engine → compute DI (komposit + per standard) vs JN scores.
    """
    codes      = json.loads(school_codes)
    jn_map     = json.loads(jn_scores)
    jn_dom_map = json.loads(jn_domain_scores)
    field_map  = json.loads(field_mappings)

    # Detect file type
    filename = file.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"

    # Save to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    # ── Agent 0: process document ──────────────────────────────────────────────
    try:
        a0_result = agent_0.run(tmp_path, ext, {"school_code": codes[0] if codes else "UNKNOWN"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent 0 error: {str(e)}")
    finally:
        import os as _os
        try: _os.unlink(tmp_path)
        except: pass

    # ── For each school code, apply mapping ───────────────────────────────────
    results = []
    for code in codes:
        jn_score = jn_map.get(code)
        mapping  = map_and_score(a0_result["extracted_scores"], jn_score, field_map or None,
                                 jn_dom_map.get(code))

        results.append({
            "school_code":                code,
            "source_system":              source_system,
            "extracted_scores":           a0_result["extracted_scores"],
            "mapped_scores":              mapping["mapped_scores"],
            "composite_operational_score": mapping["composite_operational_score"],
            "jn_audit_score":             jn_score,
            "discrepancy_index":          mapping["discrepancy_index"],
            "di_classification":          mapping["di_classification"],
            "alert_level":                mapping["alert_level"],
            "domain_di":                  mapping["domain_di"],
            "data_type":                  a0_result["data_type"],
            "agent0_confidence":          a0_result["agent0_confidence"],
            "conversion_method":          a0_result["conversion_method"],
            "qualitative_text":           a0_result.get("qualitative_text"),
            "source_file_name":           filename,
            "pull_date":                  date.today().isoformat(),
        })

    return {
        "source": source_system,
        "file": filename,
        "document_preview": a0_result.get("raw_text_preview", ""),
        "records": results,
    }

# ═══════════════════════════════════════════════════════════════════════════════
# INGESTION — STANDALONE AGENT 0
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/ai/agent-0")
async def run_agent_0(file: UploadFile = File(...)):
    """Standalone Agent 0 — parse document and return extracted scores."""
    filename = file.filename or "upload"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"

    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        result = agent_0.run(tmp_path, ext, {})
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        import os as _os
        try: _os.unlink(tmp_path)
        except: pass

# ═══════════════════════════════════════════════════════════════════════════════
# SCHEDULER
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/ai/scheduler/status")
def get_scheduler_status():
    return scheduler_status()

@app.post("/ai/scheduler/trigger")
async def trigger_scheduler():
    """Manual trigger untuk monthly pull job."""
    try:
        await monthly_pull_job()
        return {"status": "triggered", "message": "Monthly pull job executed manually"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# .env reload trigger: GDrive credentials configured 2026-07-12
