"""
Agent C: Executive Briefing Generation
AI Category: Agentic AI — Ollama llama3.2 (local) + RAG (TF-IDF)
Enforcement actions & policy mapping: Rule-Based (deterministic)
"""
import os
import re
import json
import hashlib
import urllib.request
from utils.di_calculator import get_enforcement_actions, get_tempoh_tindakan

OLLAMA_URL   = os.getenv("OLLAMA_URL",   "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

_rag_index = None  # (TfidfVectorizer, matrix, docs_list, sources_list)

# Built-in knowledge base — legal references embedded directly (no external files needed)
KNOWLEDGE_BASE = [
    {"source": "Akta Pendidikan 1996, Seksyen 59", "text": "Pengetua atau Guru Besar sekolah bertanggungjawab memastikan rekod dan data sekolah adalah tepat dan tidak dipalsukan. Kegagalan berbuat demikian boleh mengakibatkan tindakan tatatertib."},
    {"source": "PKPA Bil. 5/2007", "text": "Penjaminan kualiti perkhidmatan awam memerlukan pemantauan berterusan. Agensi perlu mewujudkan mekanisme pengesanan anomali data dan melaporkan kepada pihak berkuasa dalam tempoh yang ditetapkan."},
    {"source": "SKPMG2 Standard 2017", "text": "Standard Kualiti Pendidikan Malaysia Gelombang 2 menetapkan skor rujukan bagi setiap domain: Kepimpinan, Pengurusan Organisasi, Pengurusan Kurikulum, Kokurikulum, dan Hal Ehwal Murid. Discrepancy antara skor dilaporkan dan skor audit melebihi 25 mata memerlukan siasatan segera."},
    {"source": "Arahan Perbendaharaan 2017, Perenggan 28", "text": "Semua agensi kerajaan hendaklah menjalani audit dalaman sekurang-kurangnya sekali setahun. Sekolah yang tidak diaudit dalam tempoh tiga tahun (1095 hari) dianggap berisiko tinggi dan perlu diaudit dalam 60 hari."},
    {"source": "Akta SPRM 2009 (Akta 694)", "text": "Suruhanjaya Pencegahan Rasuah Malaysia mempunyai bidang kuasa untuk menyiasat kes rasuah, salah guna kuasa, dan penyelewengan dalam sektor awam termasuk institusi pendidikan. Kes yang melibatkan manipulasi data dengan niat menipu perlu dirujuk kepada SPRM."},
    {"source": "Dasar EMIS KPM 2022", "text": "Akses kepada Educational Management Information System (EMIS) boleh digantung apabila didapati data yang dimasukkan tidak tepat atau telah dimanipulasi. Penggantungan akses memerlukan kelulusan Pengarah Pendidikan Negeri."},
    {"source": "Protokol Tindakan JN — EXTREME_DISCREPANCY", "text": "Bagi kes discrepancy ekstrem (DI >= 0.75): (1) Audit buta dalam 24 jam, (2) Gantung akses EMIS, (3) Lapor kepada KPM dan SPRM jika ada petunjuk penyelewengan, (4) Hantar pasukan audit khas."},
    {"source": "Protokol Tindakan JN — SEVERE_DISCREPANCY", "text": "Bagi kes discrepancy teruk (DI 0.50-0.74): (1) Audit mengejut dalam 48 jam, (2) Notis rasmi kepada Pengetua, (3) Laporan kepada Pengarah Pendidikan Negeri, (4) Pemantauan intensif 60 hari."},
    {"source": "Protokol Tindakan JN — MODERATE_DISCREPANCY", "text": "Bagi kes discrepancy sederhana (DI 0.25-0.49): (1) Notis amaran rasmi, (2) Pemantauan intensif 30 hari, (3) Semak semua data EMIS, (4) Audit susulan dalam 90 hari."},
]


def _ollama_generate(prompt: str) -> str:
    """Call Ollama chat API and return the response text."""
    payload = json.dumps({
        "model": OLLAMA_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.0, "num_predict": 900},
    }).encode()
    req = urllib.request.Request(
        f"{OLLAMA_URL}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
    content = data["message"]["content"]
    # Strip markdown code fences if model wraps JSON in ```json ... ```
    content = re.sub(r'^```(?:json)?\s*', '', content.strip(), flags=re.IGNORECASE)
    content = re.sub(r'\s*```$', '', content.strip())
    return content


def _build_rag_index():
    """Build TF-IDF RAG index from built-in knowledge base."""
    global _rag_index
    if _rag_index is not None:
        return _rag_index
    from sklearn.feature_extraction.text import TfidfVectorizer
    import numpy as np

    docs = [kb["text"] for kb in KNOWLEDGE_BASE]
    sources = [kb["source"] for kb in KNOWLEDGE_BASE]
    vectorizer = TfidfVectorizer(ngram_range=(1, 2))
    matrix = vectorizer.fit_transform(docs)
    _rag_index = (vectorizer, matrix, docs, sources)
    return _rag_index


def _get_rag_context(query: str) -> tuple[str, list[str]]:
    """Retrieve top-k relevant chunks using TF-IDF cosine similarity."""
    import numpy as np
    from sklearn.metrics.pairwise import cosine_similarity

    try:
        vectorizer, matrix, docs, sources = _build_rag_index()
        q_vec = vectorizer.transform([query])
        scores = cosine_similarity(q_vec, matrix).flatten()
        top_k = min(4, len(docs))
        top_idx = np.argsort(scores)[::-1][:top_k]
        retrieved_docs = [docs[i] for i in top_idx if scores[i] > 0.01]
        retrieved_sources = [sources[i] for i in top_idx if scores[i] > 0.01]
        return "\n\n".join(retrieved_docs), retrieved_sources
    except Exception:
        return "", []


def _build_domain_breakdown(weak_domains: list) -> str:
    """Blok teks domain SKPM terlemah + senarai semakan konkrit — dipetik
    Ollama secara langsung supaya arahan_khusus spesifik kepada bidang,
    bukan kenyataan generik ("mulakan pemantauan intensif" tanpa fokus)."""
    if not weak_domains:
        return ""
    lines = []
    for wd in weak_domains:
        gap_info = f" — jurang {wd['gap']} mata (operasi {wd['score']} vs audit JN {wd['jn_score']})" if wd.get("gap") is not None else f" — skor audit JN {wd['score']}/100"
        lines.append(f"• {wd['label']}{gap_info}")
        for item in wd.get("checklist", []):
            lines.append(f"    - {item}")
    return "\n".join(lines)


def _build_prompt(payload: dict, agent_a: dict, agent_b: dict, rag_context: str) -> str:
    flags_str = "\n".join(f"  - {f}" for f in agent_b.get("risk_flags", []))
    actions_str = "\n".join(f"  {i+1}. {a}" for i, a in enumerate(agent_b.get("enforcement_actions", [])))
    policy_str = "\n".join(
        f"  - [{p['flag']}] {p.get('action', '')} (Rujukan: {p.get('legal', '')})"
        for p in agent_b.get("policy_recommendations", [])
    )
    weak_domains = agent_b.get("weak_domains", [])
    domain_str = _build_domain_breakdown(weak_domains)

    return f"""KONTEKS UNDANG-UNDANG & DASAR (dari pangkalan pengetahuan JN):
{rag_context if rag_context else "Tiada konteks RAG tersedia — gunakan pengetahuan umum dasar pendidikan Malaysia."}

---
DATA KES:
- Sekolah: {payload.get('school_name', 'N/A')} ({payload.get('school_id', 'N/A')})
- Skor Operasi Dilaporkan: {payload.get('operational_score')}/100
- Skor Audit JN Rasmi: {agent_b.get('jn_audit_score_used')}/100
- Discrepancy Index (DI): {agent_b.get('di_value')} → {agent_b.get('di_classification')}
- Tahap Amaran: {agent_b.get('alert_level')}
- Kategori Insiden: {agent_a.get('category')}
- Keterukan: {agent_a.get('severity')}
- Anomali Dikesan: {"YA" if agent_b.get('anomaly_detected') else "TIDAK"}
- Flags Risiko:
{flags_str if flags_str else "  (Tiada flag)"}

TINDAKAN PENGUATKUASAAN YANG DIPERLUKAN:
{actions_str}

CADANGAN DASAR:
{policy_str if policy_str else "  Tiada cadangan tambahan."}

DOMAIN SKPM YANG PALING MEMERLUKAN TINDAKAN (paling teruk dahulu, dengan senarai semakan konkrit):
{domain_str if domain_str else "  Tiada data domain SKPM tersedia bagi sekolah ini."}

---
ARAHAN:
Sediakan arahan eksekutif rasmi dalam Bahasa Malaysia untuk kes ini. Gunakan bahasa formal perkhidmatan awam.
Dokumen ini memerlukan tandatangan manusia sebelum pengedaran rasmi.

KEPERLUAN KHUSUS UNTUK "arahan_khusus":
- SETIAP arahan MESTI dikaitkan dengan domain/standard SKPM yang spesifik daripada senarai "DOMAIN SKPM YANG PALING MEMERLUKAN TINDAKAN" di atas (jika tersedia) — jangan sekali-kali tulis kenyataan generik seperti "mulakan pemantauan intensif" tanpa menyatakan bidang/standard yang ditumpukan.
- Gunakan terus item dalam senarai semakan konkrit yang diberi (cth. "Semak Rancangan Pengajaran Harian (RPH) dan minit mesyuarat panitia (Standard 3.1.1, 3.1.2)") sebagai asas arahan, ubah suai bahasa jika perlu supaya kekal rasmi.
- Jika tiada data domain SKPM tersedia, arahan_khusus masih perlu spesifik kepada kategori insiden dan flag risiko yang disenaraikan di atas.

Output MESTI dalam format JSON tepat seperti berikut:
{{
  "tajuk_kes": "...",
  "ringkasan_eksekutif": "...",
  "penemuan_utama": ["...", "..."],
  "konteks_undang_undang": "...",
  "arahan_khusus": ["...", "..."],
  "tempoh_tindakan": "...",
  "nota_penutup": "..."
}}"""


def _static_template_fallback(payload: dict, agent_a: dict, agent_b: dict) -> str:
    """Deterministic fallback when Ollama unavailable. Arahan_khusus dibina
    daripada senarai semakan konkrit per domain SKPM terlemah (weak_domains,
    dari agent_b) supaya tetap spesifik kepada bidang — bukan kenyataan
    generik seperti "mulakan pemantauan intensif" tanpa fokus — walaupun
    LLM tidak digunakan."""
    weak_domains = agent_b.get("weak_domains", [])

    arahan_khusus = []
    if weak_domains:
        for wd in weak_domains:
            gap_note = f" (jurang {wd['gap']} mata)" if wd.get("gap") is not None else ""
            arahan_khusus.append(f"Tumpukan pemantauan ke atas {wd['label']}{gap_note}:")
            arahan_khusus.extend(wd.get("checklist", []))
    if not arahan_khusus:
        arahan_khusus = list(agent_b.get("enforcement_actions", ["Ambil tindakan bersesuaian."]))

    # Elak duplikasi: flag WEAK_DOMAIN_* sudah diwakili baris "Domain terlemah"
    # yang lebih mudah dibaca di bawah — flag mentah kekal dalam risk_flags
    # (dipaparkan berasingan sebagai chip teknikal di UI).
    penemuan_utama = [f for f in agent_b.get("risk_flags", []) if not f.startswith("WEAK_DOMAIN_")]
    for wd in weak_domains:
        gap_note = f" — jurang {wd['gap']} mata (operasi {wd['score']} vs audit JN {wd['jn_score']})" if wd.get("gap") is not None else f" — skor audit JN {wd['score']}/100"
        penemuan_utama.append(f"Domain terlemah: {wd['label']}{gap_note}")

    return json.dumps({
        "tajuk_kes": f"Arahan Eksekutif — Kes Discrepancy Data Sekolah {payload.get('school_id', 'N/A')}",
        "ringkasan_eksekutif": (
            f"Sistem MyQA@JN telah mengesan discrepancy pada tahap {agent_b.get('di_classification')} "
            f"(DI = {agent_b.get('di_value')}) bagi sekolah {payload.get('school_name', 'N/A')}. "
            f"Tahap amaran: {agent_b.get('alert_level')}. Tindakan segera diperlukan."
        ),
        "penemuan_utama": penemuan_utama,
        "konteks_undang_undang": "Akta Pendidikan 1996, PKPA Bil. 5/2007, SKPMG2 Standard 2017",
        "arahan_khusus": arahan_khusus,
        "tempoh_tindakan": get_tempoh_tindakan(agent_b.get("di_classification", "DATA_ALIGNED")),
        "nota_penutup": "Dokumen ini dijana secara automatik oleh sistem MyQA@JN dan MESTI disemak serta ditandatangani oleh pegawai yang bertanggungjawab sebelum pengedaran rasmi.",
    }, ensure_ascii=False, indent=2)


def run(payload: dict, agent_a: dict, agent_b: dict) -> dict:
    # Enforcement actions — Rule-Based (deterministic lookup)
    enforcement_actions = get_enforcement_actions(agent_b.get("di_classification", "DATA_ALIGNED"))
    agent_b["enforcement_actions"] = enforcement_actions

    # RAG retrieval
    query = f"{agent_b.get('di_classification')} {agent_a.get('category')} sekolah Malaysia tindakan penguatkuasaan"
    rag_context, rag_sources = _get_rag_context(query)

    # Build prompt
    prompt = _build_prompt(payload, agent_a, agent_b, rag_context)
    prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()[:16]

    # LLM generation — Ollama llama3.2 (local)
    directive_text = None
    model_used = None

    tempoh_tindakan = get_tempoh_tindakan(agent_b.get("di_classification", "DATA_ALIGNED"))

    try:
        directive_text = _ollama_generate(prompt)
        model_used = OLLAMA_MODEL
        # Validate it's valid JSON, then override tempoh_tindakan — deterministic
        # (rule-based), not left to the LLM to invent a deadline.
        parsed = json.loads(directive_text)
        parsed["tempoh_tindakan"] = tempoh_tindakan
        directive_text = json.dumps(parsed, ensure_ascii=False, indent=2)
    except Exception as e:
        directive_text = None

    # Fallback to static template if LLM failed
    if not directive_text:
        directive_text = _static_template_fallback(payload, agent_a, agent_b)
        model_used = "static_template_fallback"

    return {
        "enforcement_actions": enforcement_actions,
        "policy_recommendations": agent_b.get("policy_recommendations", []),
        "legal_references": list({p.get("legal", "") for p in agent_b.get("policy_recommendations", []) if p.get("legal")}),
        "directive_text": directive_text,
        "rag_sources": rag_sources,
        "model_used": model_used,
        "prompt_hash": prompt_hash,
    }
