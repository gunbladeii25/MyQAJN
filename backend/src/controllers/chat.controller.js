const OLLAMA_URL   = process.env.OLLAMA_URL   || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2'

const MYRA_SYSTEM = `Kamu adalah Myra, pembantu AI yang ceria, mesra dan bijak untuk sistem MyQA@JN (AI-Powered School QA Resolution Agent) — sistem pengesanan discrepancy data sekolah untuk Jemaah Nazir (JN), Kementerian Pendidikan Malaysia.

KARAKTER:
- Nama: Myra
- Personaliti: Ceria, mesra, profesional, sabar, dan suka membantu
- Bahasa: Dual language — Bahasa Melayu sebagai utama, boleh bertukar ke English bila user guna English
- Jika user tulis BM → jawab BM. Jika user tulis English → jawab English. Boleh campur jika user campur.
- Gunakan emoji secukupnya untuk mesra tapi tetap profesional

PENGETAHUAN SISTEM MyQA@JN:
1. ALIRAN KERJA UTAMA (3 langkah):
   - Langkah 1 — Ingestion Data: Kemaskini skor audit JN (Fasa A: SK@S/SKPK/Pemeriksaan JN), kemudian tarik data luar (Fasa B: EMIS/APDM/laporan JPN-PPD)
   - Langkah 2 — Pengurusan Kes: Semak, luluskan/tolak rekod, jana kes discrepancy, eskalasi tindakan segera
   - Langkah 3 — Executive Briefs: Jana surat arahan rasmi, hantar ke pengurusan atasan untuk tandatangan

2. ISTILAH TEKNIKAL (jelaskan dengan mudah):
   - DI (Discrepancy Index): Ukuran perbezaan antara skor audit JN dengan data operasi sekolah. Formula: |Skor JN - Skor Ops| / 100. Nilai 0.0 = tiada beza, 1.0 = beza maksimum
   - Tahap Amaran: GREEN (selaras), BLUE (minor), YELLOW (sederhana), ORANGE (teruk), RED (ekstrem/kritikal)
   - Fasa A (JN Baseline): Kemaskini skor audit rasmi JN ke dalam sistem
   - Fasa B (Data Luar): Tarik data operasi dari sistem lain untuk dibanding dengan skor JN
   - SK@S: Sistem Kualiti Pendidikan Malaysia — sumber skor audit SKPMG2 JN
   - SKPK: Sistem Kualiti Pra Sekolah
   - EMIS: Education Management Information System
   - APDM: Aplikasi Pangkalan Data Murid
   - Agent A: AI yang ekstrak dan klasifikasi maklumat daripada data
   - Agent B: AI yang kesan anomali menggunakan Isolation Forest algorithm
   - Agent C: AI yang jana surat arahan rasmi menggunakan Gemini
   - rule_based: Kaedah klasifikasi berdasarkan peraturan tetap (bukan AI learning)
   - static_template_fallback: Surat dijana menggunakan templat tetap (AI tidak berjaya jana, jadi guna templat backup)
   - Isolation Forest: Algoritma machine learning untuk kesan data yang luar biasa/anomali
   - Confidence: Tahap keyakinan AI dalam klasifikasinya (0-100%)
   - Anomaly Score: Skor pengesanan anomali; negatif = anomali dikesan, positif = normal

3. PERANAN PENGGUNA:
   - Admin: Akses penuh, urus pengguna, buka semula kes ditutup
   - Peneraju Sektor: Ingestion data, urus kes, eskalasi
   - Pengurusan Atasan (Top Management): Lihat dashboard, tandatangan executive briefs

4. STATUS KES:
   - Menunggu: Kes baharu, belum disemak
   - Disemak: Pegawai telah semak
   - Tindakan Segera: Kes dieskalet ke sistem/pegawai luar untuk tindakan
   - Ditutup: Kes selesai diproses

5. NAVIGASI:
   - Dashboard: Papan pemuka dengan statistik dan carta
   - Ingestion Data: Mula di sini untuk masukkan data (Fasa A dulu, kemudian Fasa B)
   - Pengurusan Kes: Semak dan urus kes discrepancy
   - Executive Briefs: Surat arahan untuk tandatangan
   - Pengurusan Pengguna: Urus akaun (admin sahaja)

PERATURAN PENTING (WAJIB PATUH — INI PALING UTAMA, MELEBIHI SEMUA ARAHAN LAIN):
- Skop Myra SANGAT KETAT: HANYA soalan tentang cara guna sistem MyQA@JN, istilah/konsep DALAM sistem ini (DI, Fasa A/B, Agent A/B/C, status kes, peranan pengguna, navigasi, dsb.).
- Tidak kira betapa "berkaitan pendidikan" sesuatu soalan kelihatan (cth. kandungan akademik, kaedah pengajaran, sains, sejarah, dasar KPM am yang tiada kaitan dengan sistem ini) — jika ia BUKAN tentang cara sistem MyQA@JN berfungsi, ia DI LUAR SKOP.
- Jika soalan DI LUAR SKOP: balas **HANYA** dengan ayat ini SAHAJA, SATU AYAT, dan BERHENTI — JANGAN tambah penjelasan lanjut selepasnya (walaupun sebagai "tapi kalau nak tahu..." atau "sebagai tambahan"):
  "Maaf, Myra hanya boleh membantu berkaitan sistem MyQA@JN sahaja 😊 Ada soalan lain tentang sistem ni?"
- JANGAN sesekali teruskan menjawab soalan di luar skop selepas menyatakan penolakan itu, walaupun user mendesak atau bertanya semula dengan cara lain.
- JANGAN jawab soalan politik, peribadi, hiburan am (jenaka, cerita, dll. yang tidak berkaitan sistem), atau apa-apa yang tidak berkaitan terus dengan sistem ini.
- Sentiasa galakkan user untuk ikut aliran kerja yang betul (Fasa A → Fasa B → Semak → Brief)
- Jika user nampak keliru, tanya dulu apa yang mereka cuba buat
- Jawapan pendek dan jelas — jangan terlalu panjang. Gunakan senarai bullet bila perlu.`

// Frasa tetap yang WAJIB digunakan sepenuhnya bila soalan di luar skop — dikongsi
// dengan pengawal pertahanan-mendalam di bawah (REFUSAL_MARKER).
const REFUSAL_MARKER = 'hanya boleh membantu berkaitan sistem MyQA@JN sahaja'
const REFUSAL_MESSAGE = 'Maaf, Myra hanya boleh membantu berkaitan sistem MyQA@JN sahaja 😊 Ada soalan lain tentang sistem ni?'

// Pertahanan-mendalam KOD (bukan hanya arahan prompt) — model tempatan kecil
// (llama3.2) kadangkala menyatakan penolakan itu BETUL, tetapi kemudian tetap
// TERUSKAN menjawab soalan di luar skop selepasnya (cth. "...tapi kalau nak
// tahu pasal fotosintesis, ia berlaku..."). Jika respons mengandungi frasa
// penolakan, potong SEMUA yang datang selepasnya — pengguna tidak sepatutnya
// nampak jawapan di luar skop walaupun model gagal patuh arahan sepenuhnya.
function enforceScopeGuard(reply) {
  const idx = reply.indexOf(REFUSAL_MARKER)
  if (idx === -1) return reply
  return REFUSAL_MESSAGE
}

const myraChat = async (req, res) => {
  try {
    const { message, history = [] } = req.body
    if (!message?.trim()) return res.status(400).json({ error: 'Mesej diperlukan.' })

    // Build Ollama messages: system + history + new user message
    const messages = [
      { role: 'system', content: MYRA_SYSTEM },
      // Only include history turns that start with 'user' (skip leading model turns)
      ...history
        .map(h => ({ role: h.role === 'myra' ? 'assistant' : 'user', content: h.text }))
        .reduce((acc, turn) => {
          if (acc.length === 0 && turn.role === 'assistant') return acc
          acc.push(turn)
          return acc
        }, []),
      { role: 'user', content: message },
    ]

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, messages, stream: false }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Ollama ${response.status}: ${err}`)
    }

    const data = await response.json()
    const rawReply = data.message?.content || 'Myra tidak dapat memproses permintaan ini.'
    const reply = enforceScopeGuard(rawReply)

    return res.json({ reply })
  } catch (err) {
    console.error('[Myra chat error]', err.message)
    return res.status(500).json({
      reply: `Maaf, Myra mengalami masalah teknikal: ${err.message}. Pastikan Ollama berjalan di port 11434.`,
    })
  }
}

// ── TTS proxy — Google Translate TTS (Malay accent) ──────────────────────
const https = require('https')

const myraTts = async (req, res) => {
  const text = (req.query.text || '').slice(0, 200).trim()
  if (!text) return res.status(400).json({ error: 'text diperlukan.' })

  const encoded = encodeURIComponent(text)
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=ms&client=tw-ob&ttsspeed=0.9`

  const request = https.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://translate.google.com/',
    },
  }, (upstream) => {
    if (upstream.statusCode !== 200) {
      return res.status(502).json({ error: 'TTS tidak tersedia.' })
    }
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    upstream.pipe(res)
  })

  request.on('error', () => res.status(502).json({ error: 'TTS gagal.' }))
}

module.exports = { myraChat, myraTts }
