"""
SKPM Kualiti@Sekolah — Struktur Instrumen (SK@S / JN Baseline)

Rujukan: Instrumen SKPM Kualiti@Sekolah (BAB 3).
Hierarki: Komponen → Standard/Domain → Aspek → skor.

  Kekuatan Kami   : Aspek A1–A9 (peratus)
  Pengurusan Kami : Standard 1–4, setiap aspek diskor 0–4 → ditukar ke peratus (skor/4 × 100)
  Pencapaian Kami : Standard 5 (peratus/GPS)

Setiap DOMAIN di bawah sepadan dengan satu Standard (atau sub-standard bagi
Standard 3) supaya laporan boleh dipecah mengikut bidang: Kepimpinan,
Pengurusan Organisasi, Kurikulum, Kokurikulum, HEM, PdP, Kemenjadian Murid,
dan Kekuatan (Prasarana & Sumber).

NOTA WAJARAN: DOMAIN_WEIGHTS di bawah adalah nilai sementara untuk
pembangunan. Wajaran rasmi mesti disahkan dengan pihak Jemaah Nazir
sebelum produksi. Jumlah wajaran mesti = 1.0.
"""

# Domain → senarai aspek SKPM (kod aspek seperti dalam instrumen)
SKPM_DOMAINS = {
    "kekuatan": {
        "label":    "Kekuatan (Prasarana & Sumber)",
        "komponen": "Kekuatan Kami",
        "aspects": {
            "A1": "Guru",
            "A2": "Kualiti Pengajaran dan Pembelajaran",
            "A3": "Staf Bukan Guru",
            "A4": "Prasarana Akademik",
            "A5": "Prasarana Sukan dan Kokurikulum",
            "A6": "Prasarana Hal Ehwal Murid",
            "A7": "Persekitaran Digital",
            "A8": "Asrama",
            "A9": "Sokongan Ibu Bapa/Penjaga, Komuniti dan Pihak Swasta",
        },
    },
    "kepimpinan": {
        "label":    "Kepemimpinan (Standard 1)",
        "komponen": "Pengurusan Kami",
        "aspects": {
            "1.1": "PGB Sebagai Peneraju",
            "1.2": "PGB Sebagai Pembimbing",
            "1.3": "PGB Sebagai Pendorong",
        },
    },
    "pengurusan_organisasi": {
        "label":    "Pengurusan Organisasi (Standard 2)",
        "komponen": "Pengurusan Kami",
        "aspects": {
            "2.1": "Pengurusan Sumber Manusia",
            "2.2": "Pengurusan Aset",
            "2.3": "Pengurusan Kewangan",
            "2.4": "Pengurusan Sumber Pendidikan",
            "2.5": "Iklim",
            "2.6": "Pengurusan Perpaduan",
            "2.7": "Permuafakatan Strategik",
        },
    },
    "pengurusan_kurikulum": {
        "label":    "Pengurusan Kurikulum (Standard 3.1)",
        "komponen": "Pengurusan Kami",
        "aspects": {
            "3.1.1": "Ketetapan Pelaksanaan Kurikulum",
            "3.1.2": "Pengurusan Mata Pelajaran",
            "3.1.3": "Pengurusan Masa Instruksional",
            "3.1.4": "Pengurusan Penilaian Murid",
        },
    },
    "pengurusan_kokurikulum": {
        "label":    "Pengurusan Kokurikulum (Standard 3.2)",
        "komponen": "Pengurusan Kami",
        "aspects": {
            "3.2.1": "Ketetapan Pelaksanaan Kokurikulum",
            "3.2.2": "Pengurusan Kelab/Persatuan",
            "3.2.3": "Pengurusan Badan Beruniform",
            "3.2.4": "Pengurusan Sukan/Permainan",
            "3.2.5": "Pengurusan Program Kecemerlangan Kokurikulum",
            "3.2.6": "Pengurusan Sukan untuk Semua",
            "3.2.7": "Pengurusan Pentaksiran Kokurikulum",
        },
    },
    "pengurusan_hem": {
        "label":    "Pengurusan Hal Ehwal Murid (Standard 3.3)",
        "komponen": "Pengurusan Kami",
        "aspects": {
            "3.3.1": "Ketetapan Pelaksanaan Hal Ehwal Murid",
            "3.3.2": "Pengurusan Disiplin Murid",
            "3.3.3": "Pengurusan Keselamatan Murid",
            "3.3.4": "Pengurusan Kesihatan Murid",
            "3.3.5": "Pengurusan Bantuan Pelajaran Murid",
            "3.3.6": "Pengurusan Perkhidmatan Bimbingan dan Kaunseling",
            "3.3.7": "Pengurusan Pentaksiran Psikometrik",
        },
    },
    "pdpc": {
        "label":    "Pembelajaran dan Pemudahcaraan (Standard 4)",
        "komponen": "Pengurusan Kami",
        "aspects": {
            "4.1": "Guru Sebagai Perancang",
            "4.2": "Guru Sebagai Pengawal",
            "4.3": "Guru Sebagai Pembimbing",
            "4.4": "Guru Sebagai Pendorong",
            "4.5": "Guru Sebagai Penilai",
            "4.6": "Murid Sebagai Pembelajar Aktif",
        },
    },
    "kemenjadian_murid": {
        "label":    "Kemenjadian Murid, Guru & Sekolah (Standard 5)",
        "komponen": "Pencapaian Kami",
        "aspects": {
            "5.1": "Kemenjadian Murid dalam Akademik",
            "5.2": "Kemenjadian Murid dalam Kokurikulum",
            "5.3": "Kemenjadian Sahsiah Murid",
            "5.4": "Pencapaian Guru dan Pencapaian Sekolah",
        },
    },
}

# Wajaran domain → komposit jnAuditScore. SEMENTARA — sahkan dengan JN.
DOMAIN_WEIGHTS = {
    "kekuatan":               0.10,
    "kepimpinan":             0.15,
    "pengurusan_organisasi":  0.10,
    "pengurusan_kurikulum":   0.15,
    "pengurusan_kokurikulum": 0.05,
    "pengurusan_hem":         0.10,
    "pdpc":                   0.20,
    "kemenjadian_murid":      0.15,
}

assert abs(sum(DOMAIN_WEIGHTS.values()) - 1.0) < 1e-9, "DOMAIN_WEIGHTS mesti berjumlah 1.0"


def rollup_domains(aspect_scores: dict) -> dict:
    """
    Kira skor domain daripada skor aspek (peratus 0–100).

    aspect_scores: {"1.1": 78.5, "1.2": 82.0, ...} — kod aspek SKPM → peratus.
    Returns: {domain_key: {"label", "komponen", "score", "aspect_scores"}}
    Domain tanpa sebarang aspek diberi score None (cth. tiada data A8 Asrama
    untuk sekolah tanpa asrama — aspek berkenaan boleh diabaikan sahaja).
    """
    result = {}
    for key, spec in SKPM_DOMAINS.items():
        found = {code: aspect_scores[code] for code in spec["aspects"] if aspect_scores.get(code) is not None}
        score = round(sum(found.values()) / len(found), 2) if found else None
        result[key] = {
            "label":         spec["label"],
            "komponen":      spec["komponen"],
            "score":         score,
            "aspect_scores": found,
        }
    return result


# Senarai semakan konkrit per domain — dipetik terus ke dalam arahan_khusus
# (Agent C) supaya syor sentiasa spesifik kepada bidang SKPM berkenaan, bukan
# kenyataan generik seperti "mulakan pemantauan intensif". Deterministik
# (rule-based), jadi kekal berkualiti walaupun LLM (Ollama) tidak tersedia.
DOMAIN_ACTION_CHECKLIST = {
    "kekuatan": [
        "Audit prasarana akademik, sukan dan asrama berbanding piawaian SKPM (aspek A4-A8)",
        "Semak kelayakan dan taburan opsyen guru (aspek A1)",
        "Nilai persekitaran digital dan capaian ICT murid/guru (aspek A7)",
    ],
    "kepimpinan": [
        "Semak minit mesyuarat pengurusan tertinggi dan pelan strategik PGB (Standard 1.1)",
        "Nilai bukti bimbingan PGB kepada guru (pemerhatian PdP, coaching) (Standard 1.2)",
        "Semak mekanisme dorongan/motivasi staf oleh kepimpinan sekolah (Standard 1.3)",
    ],
    "pengurusan_organisasi": [
        "Audit rekod kewangan dan pengurusan aset sekolah (Standard 2.2, 2.3)",
        "Semak fail peribadi dan pengurusan sumber manusia (Standard 2.1)",
        "Nilai iklim sekolah dan permuafakatan strategik dengan PIBG/komuniti (Standard 2.5, 2.7)",
    ],
    "pengurusan_kurikulum": [
        "Semak Rancangan Pengajaran Harian (RPH) dan minit mesyuarat panitia mata pelajaran (Standard 3.1.1, 3.1.2)",
        "Audit pengurusan masa instruksional (jadual waktu, ganti kelas) (Standard 3.1.3)",
        "Sahkan pengurusan pentaksiran dan analisis pencapaian murid (Standard 3.1.4)",
    ],
    "pengurusan_kokurikulum": [
        "Semak rekod penyertaan dan pencapaian kelab/persatuan, badan beruniform, sukan (Standard 3.2.2-3.2.4)",
        "Audit pengurusan pentaksiran kokurikulum dan program kecemerlangan (Standard 3.2.5, 3.2.7)",
    ],
    "pengurusan_hem": [
        "Semak rekod disiplin, kaunseling dan kes murid berisiko (Standard 3.3.2, 3.3.6)",
        "Audit pengurusan keselamatan dan kesihatan murid (Standard 3.3.3, 3.3.4)",
        "Sahkan pengurusan bantuan pelajaran/kebajikan murid (Standard 3.3.5)",
    ],
    "pdpc": [
        "Lakukan pemerhatian PdP (observation) untuk menilai guru sebagai perancang, pengawal dan pendorong (Standard 4.1-4.4)",
        "Semak instrumen penilaian PdP dan tindakan susulan guru (Standard 4.5)",
        "Nilai tahap penglibatan aktif murid dalam pembelajaran (Standard 4.6)",
    ],
    "kemenjadian_murid": [
        "Audit keputusan peperiksaan dalaman/awam dan trend pencapaian akademik (Standard 5.1)",
        "Semak pencapaian kokurikulum dan sahsiah murid (Standard 5.2, 5.3)",
        "Nilai pencapaian profesional guru dan pengiktirafan sekolah (Standard 5.4)",
    ],
}


def identify_weak_domains(jn_domain_scores: dict | None = None, domain_di: dict | None = None, top_n: int = 2) -> list[dict]:
    """
    Kenal pasti domain SKPM yang paling memerlukan tindakan, untuk dipetik
    terus dalam arahan_khusus Agent C (elak kenyataan generik).

    Keutamaan: domain_di (perbandingan DUA belah — operasi vs audit JN,
    dari mapping_engine.map_and_score semasa kelulusan ingestion) kerana ia
    menunjukkan JURANG sebenar. Jika tiada, jatuh balik kepada jn_domain_scores
    (skor audit JN sahaja — sekolah mana yang skor terendah, walaupun tiada
    perbandingan operasi) supaya syor tetap spesifik kepada domain, bukan
    generik, walaupun hanya satu pihak data tersedia.

    Returns: [{domain, label, score, gap, checklist}, ...] disusun paling teruk dahulu.
    """
    results = []

    if domain_di:
        ranked = sorted(domain_di.items(), key=lambda kv: kv[1].get("di", 0), reverse=True)
        for dom, info in ranked[:top_n]:
            if dom not in SKPM_DOMAINS:
                continue
            results.append({
                "domain": dom,
                "label": SKPM_DOMAINS[dom]["label"],
                "score": info.get("operational_score"),
                "jn_score": info.get("jn_score"),
                "gap": round(info.get("di", 0) * 100, 1),
                "checklist": DOMAIN_ACTION_CHECKLIST.get(dom, []),
            })
        return results

    if jn_domain_scores:
        ranked = sorted(
            ((k, v) for k, v in jn_domain_scores.items() if v is not None and k in SKPM_DOMAINS),
            key=lambda kv: kv[1],
        )
        for dom, score in ranked[:top_n]:
            results.append({
                "domain": dom,
                "label": SKPM_DOMAINS[dom]["label"],
                "score": score,
                "jn_score": None,
                "gap": None,
                "checklist": DOMAIN_ACTION_CHECKLIST.get(dom, []),
            })
        return results

    return results


def composite_from_domains(domain_scores: dict) -> float | None:
    """
    Komposit berwajaran daripada skor domain. Domain tanpa skor dikecualikan
    dan wajaran dinormalisasi semula supaya sekolah tanpa asrama (contoh)
    tidak dihukum.
    """
    usable = {k: v["score"] for k, v in domain_scores.items() if v.get("score") is not None}
    if not usable:
        return None
    total_w = sum(DOMAIN_WEIGHTS[k] for k in usable)
    return round(sum(v * DOMAIN_WEIGHTS[k] for k, v in usable.items()) / total_w, 2)
