const crypto = require('crypto')
const prisma = require('../utils/prisma')
const logger = require('../utils/logger')

const OLLAMA_URL   = process.env.OLLAMA_URL   || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2'

// PENTING: had kelompok RENDAH khusus untuk panggilan LLM (generate) — BEDA
// daripada had kelompok besar (200) yang selamat untuk /lookup (bacaan DB).
// Model tempatan kecil (llama3.2) TIDAK boleh dipercayai mengekalkan
// kiraan/susunan tepat bagi array JSON besar (~70+ item) — pernah cuba
// hantar kelompok besar terus ke LLM dan model itu menjatuhkan/gabungkan
// item, menyebabkan SETIAP item selepas titik itu tersasar SATU KEDUDUKAN
// (cth. "Kedah" tersimpan dengan terjemahan yang sepatutnya untuk "Perlis"),
// dan ini terus disimpan ke DB sebagai pasangan SALAH. Kekalkan kelompok
// kecil di sini SENTIASA, tidak kira had /lookup.
const GENERATE_BATCH_SIZE = 20

const hashText = (text) => crypto.createHash('sha256').update(text).digest('hex')

// Kod sektor dalaman (sepadan dengan SECTORS di frontend/src/constants) —
// terlalu pendek untuk SKIP_RE (< 6 aksara) di frontend, jadi LLM cuba
// "mentafsir" maksudnya dan hasilkan sampah (cth. "SPKN" -> "a more
// government my"). Disenaraikan di sini untuk semakan pertahanan bawah.
const SECTOR_CODES = ['SPKN', 'SPK', 'SDP', 'SPHEMK', 'SPIP', 'SDTM']

// Sekatan tambahan selain arahan prompt — arahan sahaja tidak menjamin model
// patuh 100%. Tolak item individu (bukan seluruh kelompok) jika keluaran
// menunjukkan corak kegagalan YANG SUDAH DIKENALPASTI:
//   1. e-mel "diterjemah" (sepatutnya disalin terus, tidak diubah).
//   2. "JPN" (Jabatan Pendidikan Negeri) disalahtafsir sebagai "Japan/Japanese".
//   3. Kod sektor pendek (SPKN, SPK, dll.) "diterjemah" jadi teks tidak berkaitan.
const isEmailLike = (s) => /^\S+@\S+\.\S+$/.test(s)
const isBadTranslation = (source, out) => {
  if (isEmailLike(source) && out !== source) return true
  if (/\bjpn\b/i.test(source) && /japan/i.test(out) && !/\bjpn\b/i.test(out)) return true
  if (SECTOR_CODES.some((code) => code.toLowerCase() === source.trim().toLowerCase()) && out.trim().toLowerCase() !== source.trim().toLowerCase()) return true
  return false
}

// Ciri multibahasa PENGGUNA (papar UI) — DB SAHAJA, tiada panggilan LLM.
// Rentetan yang belum diterjemah (tiada baris padanan) dikembalikan seadanya
// (found=false) supaya UI kekal tunjuk teks asal dengan senyap, tanpa ralat.
const lookupTranslations = async (req, res) => {
  const { texts, targetLang } = req.body
  if (!Array.isArray(texts) || texts.length === 0)
    return res.status(400).json({ error: 'texts array diperlukan.' })
  if (!targetLang) return res.status(400).json({ error: 'targetLang diperlukan.' })

  const hashes = texts.map(hashText)
  const rows = await prisma.translation.findMany({
    where: { sourceHash: { in: hashes }, language: targetLang },
  })
  const byHash = new Map(rows.map((r) => [r.sourceHash, r.translatedText]))

  const translations = texts.map((text, i) => {
    const found = byHash.get(hashes[i])
    return { text, translated: found ?? text, found: !!found }
  })

  return res.json({ translations })
}

// Panggil Ollama untuk SATU kelompok kecil (<= GENERATE_BATCH_SIZE) sahaja.
// Mengembalikan null (bukan tekaan) jika respons model tidak boleh dipercayai
// — iaitu panjang array yang dipulangkan TIDAK SAMA dengan input. Inilah
// pengawal utama: tanpa semakan ini, item selepas mana-mana ketidakpadanan
// akan tersasar kedudukan dan tersimpan sebagai pasangan SALAH ke DB (punca
// pepijat sebenar yang ditemui semasa ujian — cth. "Kedah" tersimpan dengan
// terjemahan "Perlis").
async function translateBatch(chunk, targetLang) {
  const prompt = `Translate each Bahasa Malaysia text to the language with ISO code "${targetLang}" (e.g. "EN" = English). Return ONLY a valid JSON array of strings — exactly ${chunk.length} items, one translation per item, SAME ORDER as input, no merging or skipping. No explanations, no extra keys.

IMPORTANT — domain-specific terms, keep these EXACTLY as written, do NOT translate or expand them:
- "JPN" is short for "Jabatan Pendidikan Negeri" (State Education Department, Malaysia) — it is UNRELATED to the country Japan. Never render it as "Japan" or "Japanese". Keep "JPN" as-is in the output.
- Internal sector/unit codes: SPKN, SPK, SDP, SPHEMK, SPIP, SDTM — these are short codes for organizational sectors, NOT abbreviations to expand or guess the meaning of. Keep each one exactly as written, unchanged.
- Other government acronyms (KPM, PPD, SKPM, SBP, MRSM, DI) — keep unchanged, do not spell out or reinterpret.
- Any text that looks like an email address (contains "@") — copy it through UNCHANGED, do not translate any part of it.

Input:
${JSON.stringify(chunk)}

Output (JSON array of exactly ${chunk.length} strings):`

  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    }),
  })
  if (!response.ok) throw new Error(`Ollama ${response.status}`)

  const data = await response.json()
  let content = data.message?.content || '[]'
  content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const match = content.match(/\[[\s\S]*\]/)
  const parsed = match ? JSON.parse(match[0]) : null

  if (!Array.isArray(parsed) || parsed.length !== chunk.length) {
    logger.error(`[Translate:generate] Ketidakpadanan panjang array — input ${chunk.length}, respons ${Array.isArray(parsed) ? parsed.length : typeof parsed}. Kelompok ini DILANGKAU (tidak disimpan).`)
    return null
  }
  return parsed
}

// Alat PENGARANGAN KANDUNGAN admin-sahaja — satu-satunya tempat LLM (Ollama)
// digunakan dalam ciri terjemahan. Menjana terjemahan bagi rentetan yang
// belum wujud dalam jadual, DAN SIMPAN ke DB terus (upsert ikut sourceHash+
// language) supaya carian akan datang (lookupTranslations) sentiasa DB-sahaja
// — pengguna biasa tidak pernah mencetuskan panggilan LLM.
const generateTranslations = async (req, res) => {
  const { texts, targetLang } = req.body
  if (!Array.isArray(texts) || texts.length === 0)
    return res.status(400).json({ error: 'texts array diperlukan.' })
  if (!targetLang) return res.status(400).json({ error: 'targetLang diperlukan.' })

  const translatedMap = new Map() // sourceText -> translatedText (hanya kelompok yang SAH)

  for (let i = 0; i < texts.length; i += GENERATE_BATCH_SIZE) {
    const chunk = texts.slice(i, i + GENERATE_BATCH_SIZE)
    try {
      const parsed = await translateBatch(chunk, targetLang)
      if (parsed) {
        chunk.forEach((t, idx) => {
          // Item individu yang menunjukkan corak kegagalan dikenali (e-mel
          // diterjemah, "JPN" jadi "Japan") dilangkau — teks asal itu SAHAJA
          // kekal dipaparkan, baki kelompok yang sah tetap disimpan.
          if (isBadTranslation(t, parsed[idx])) {
            logger.warn(`[Translate:generate] Ditolak (corak salah dikenali): "${t}" -> "${parsed[idx]}"`)
            return
          }
          translatedMap.set(t, parsed[idx])
        })
      }
      // parsed === null: kelompok ini dilangkau senyap — teks asal kekal
      // dipaparkan (tiada baris ditulis ke DB bagi item ini), bukan tekaan.
    } catch (err) {
      logger.error(`[Translate:generate] Ollama gagal bagi satu kelompok: ${err.message}`)
    }
  }

  // Upsert HANYA pasangan yang lulus semakan panjang — carian akan datang
  // (semua pengguna) terus dapat dari sini.
  const validEntries = [...translatedMap.entries()]
  await Promise.all(validEntries.map(([text, translated]) => {
    const sourceHash = hashText(text)
    return prisma.translation.upsert({
      where: { sourceHash_language: { sourceHash, language: targetLang } },
      update: { translatedText: translated, sourceText: text },
      create: { sourceHash, sourceText: text, language: targetLang, translatedText: translated },
    })
  }))

  logger.info(`[Translate:generate] ${req.user.email} menjana ${validEntries.length}/${texts.length} terjemahan (${targetLang})`)
  return res.json({
    translations: texts.map((text) => ({
      text, translated: translatedMap.get(text) ?? text, found: translatedMap.has(text),
    })),
  })
}

module.exports = { lookupTranslations, generateTranslations }
