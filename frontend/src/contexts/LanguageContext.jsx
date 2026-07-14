import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { lookupTranslations, generateTranslations } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import { SUPPORTED_LANGUAGES } from '../constants'

const BASE_LANG = SUPPORTED_LANGUAGES.find((l) => l.base)?.code || 'BM'

const LanguageContext = createContext({
  lang: BASE_LANG, languages: SUPPORTED_LANGUAGES, setLanguage: () => {}, translating: false,
})

// E-mel dikecualikan secara eksplisit — LLM cuba "menterjemah" alamat e-mel
// (cth. jpn.terengganu@moe.gov.my -> "Japanese in Terengganu@moe.gov.my"),
// menghasilkan keluaran tidak berguna walaupun tidak salah-padan lagi.
const SKIP_RE = /^[\d\s.,:\-/%()]+$|^[A-Z0-9\-]{6,}$|^\S+@\S+\.\S+$/
const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'code', 'pre', 'input', 'textarea', 'select'])

// Lookup ialah bacaan DB (bukan panggilan LLM), jadi tiada sebab hadkan
// kelompok kepada 30 seperti dahulu (had itu wujud untuk elak prompt LLM
// terlalu panjang). Satu laman biasa punyai jauh kurang daripada ini dalam
// satu round-trip sahaja.
const LOOKUP_BATCH_SIZE = 200

// Cache terjemahan disimpan merentas refresh pelayar (localStorage) supaya
// pengguna yang sudah lawat sesuatu laman dalam bahasa X tidak perlu
// panggilan rangkaian (walaupun pantas — bacaan DB) semula selepas refresh.
// v2: dinaikkan sengaja untuk buang cache localStorage lama yang tercemar
// oleh pepijat kelompok-tersasar (lihat GENERATE_BATCH_SIZE di backend) —
// mana-mana pelayar yang sudah simpan pasangan salah (cth. "Kedah" ->
// "Perlis JPN Project Coordinator") akan mula semula dengan cache kosong.
const CACHE_STORAGE_KEY = 'myqajn_translation_cache_v2'
const CACHE_MAX_ENTRIES = 4000

function loadPersistedCache() {
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY)
    if (!raw) return new Map()
    return new Map(JSON.parse(raw))
  } catch (_) {
    return new Map()
  }
}

function persistCache(cacheMap) {
  try {
    const entries = [...cacheMap.entries()]
    // Jika melebihi had, simpan hanya N terkini (FIFO ringkas) — elak
    // localStorage berkembang tanpa had bagi sesi yang sangat panjang.
    const trimmed = entries.length > CACHE_MAX_ENTRIES ? entries.slice(-CACHE_MAX_ENTRIES) : entries
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(trimmed))
  } catch (_) { /* localStorage penuh/disekat — cache dalam memori tetap berfungsi */ }
}

// Bahasa dipilih turut disimpan — tanpa ini, refresh pelayar akan reset ke
// BASE_LANG setiap kali, memaksa pengguna pilih semula EN walaupun cache
// (di atas) sudah sedia ada. Bersama cache berterusan, ini menjadikan
// paparan bahasa terpilih pulih segera selepas refresh, tanpa round-trip.
const LANG_STORAGE_KEY = 'myqajn_lang_v1'
const loadPersistedLang = () => { try { return localStorage.getItem(LANG_STORAGE_KEY) || BASE_LANG } catch (_) { return BASE_LANG } }
const persistLang = (code) => { try { localStorage.setItem(LANG_STORAGE_KEY, code) } catch (_) {} }

const cacheKey = (code, text) => `${code}::${text}`

// Bina semula reverseCache (translatedText -> sourceText) daripada cache yang
// dipulihkan (translatedText -> sourceText disimpan sebagai cache songsang,
// hanya cache "hadapan" yang berterusan di localStorage).
function buildReverseCache(forwardCache) {
  const reverse = new Map()
  forwardCache.forEach((translated, key) => {
    const sep = key.indexOf('::')
    if (sep === -1) return
    const lang = key.slice(0, sep)
    const source = key.slice(sep + 2)
    reverse.set(cacheKey(lang, translated), source)
  })
  return reverse
}

function getTextNodes(root) {
  const nodes = []
  try {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const text = node.textContent.trim()
        if (text.length < 3) return NodeFilter.FILTER_REJECT
        if (SKIP_RE.test(text)) return NodeFilter.FILTER_REJECT
        const tag = node.parentElement?.tagName?.toLowerCase()
        if (!tag || SKIP_TAGS.has(tag)) return NodeFilter.FILTER_REJECT
        if (node.parentElement?.closest('[data-no-translate]')) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      },
    })
    let n
    while ((n = walker.nextNode())) nodes.push(n)
  } catch (_) {}
  return nodes
}

// Kandungan multibahasa ini dipapar semata-mata daripada jadual Translation
// (backend, DB-sahaja) — TIADA panggilan LLM langsung dalam laluan papar
// biasa. Ollama hanya dicetuskan (oleh admin sahaja) apabila rentetan belum
// wujud dalam DB, sebagai alat pengarangan kandungan sekali sahaja; hasilnya
// disimpan terus supaya carian akan datang (semua pengguna) DB-sahaja.
export function LanguageProvider({ children }) {
  const initialLang = loadPersistedLang()
  const [lang, setLang] = useState(initialLang)
  const [translating, setTranslating] = useState(false)
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'

  // PENTING: cache/reverseCache dipadan mengikut KANDUNGAN TEKS semasa nod,
  // BUKAN identiti objek nod DOM. Percubaan awal menjejak "originals" melalui
  // Map<node, teksAsal> gagal pada laman yang muatkan data secara ASINKRON
  // (cth. Pengurusan Pengguna) — apabila React menyusun semula/guna semula
  // objek nod DOM untuk baris jadual yang berbeza selepas fetch selesai,
  // pemetaan lama (berdasarkan nod) terpakai pada baris yang SALAH, sebabkan
  // e-mel/peranan/status pengguna bertukar dengan data pengguna LAIN. Dengan
  // memadan ikut teks (bukan nod), operasi ini sentiasa betul tanpa mengira
  // bagaimana React menyusun semula DOM — "pulih sendiri" pada setiap imbasan.
  const cache = useRef(loadPersistedCache())            // `${lang}::${sourceText}` -> translatedText
  const reverseCache = useRef(buildReverseCache(cache.current)) // `${lang}::${translatedText}` -> sourceText
  const currentLang = useRef(initialLang)
  const busy = useRef(false)

  const rememberTranslation = useCallback((code, source, translated) => {
    cache.current.set(cacheKey(code, source), translated)
    reverseCache.current.set(cacheKey(code, translated), source)
  }, [])

  const applyCache = useCallback(() => {
    if (currentLang.current === BASE_LANG) return
    getTextNodes(document.body).forEach((node) => {
      try {
        const text = node.textContent.trim()
        const translation = cache.current.get(cacheKey(currentLang.current, text))
        if (translation && translation !== text) node.textContent = translation
      } catch (_) {}
    })
  }, [])

  // Pulihkan ke bahasa asal — padan ikut teks TERJEMAHAN semasa yang
  // dipaparkan (reverseCache), bukan senarai nod yang pernah disentuh.
  const restoreAll = useCallback((langBeingLeft) => {
    if (!langBeingLeft || langBeingLeft === BASE_LANG) return
    getTextNodes(document.body).forEach((node) => {
      try {
        const text = node.textContent.trim()
        const original = reverseCache.current.get(cacheKey(langBeingLeft, text))
        if (original && original !== text) node.textContent = original
      } catch (_) {}
    })
  }, [])

  const translatePage = useCallback(async (targetLang) => {
    if (busy.current) return
    busy.current = true
    setTranslating(true)

    try {
      const nodes = getTextNodes(document.body)
      const uncached = [...new Set(
        nodes.map((n) => n.textContent.trim())
          .filter((t) => t.length >= 3 && !SKIP_RE.test(t) && !cache.current.has(cacheKey(targetLang, t))
            // PENTING: jika teks ini SUDAH menjadi NILAI terjemahan yang
            // diketahui (wujud dalam reverseCache), ia bermakna nod ini
            // SUDAH diterjemah sebelum ini — JANGAN hantar semula sebagai
            // "sumber baharu" untuk diterjemah. Tanpa semakan ini, imbasan
            // berulang (cth. MutationObserver tercetus semula selepas teks
            // sudah bertukar ke EN) menghantar teks EN itu sendiri seolah-
            // olah ia teks BM asal, menghasilkan pemetaan pusingan-diri
            // (cth. "Work Flow" -> "Work Flow") yang merosakkan reverseCache
            // (pertindihan dengan pemetaan BETUL "Aliran Kerja" -> "Work
            // Flow") dan punca kegagalan restore ke BM.
            && !reverseCache.current.has(cacheKey(targetLang, t)))
      )]

      for (let i = 0; i < uncached.length; i += LOOKUP_BATCH_SIZE) {
        const chunk = uncached.slice(i, i + LOOKUP_BATCH_SIZE)
        try {
          const res = await lookupTranslations(chunk, targetLang)
          const results = res.data.translations || []
          const missing = []
          results.forEach(({ text, translated, found }) => {
            if (found) rememberTranslation(targetLang, text, translated)
            else missing.push(text)
          })

          // Rentetan belum wujud dalam DB — hanya admin boleh cetuskan
          // penjanaan (LLM) untuk isi jadual; pengguna lain kekal papar asal.
          if (missing.length && isAdmin) {
            try {
              const genRes = await generateTranslations(missing, targetLang)
              // found=false bermaksud backend LANGKAU kelompok itu (respons
              // LLM tidak boleh dipercayai — panjang tidak sepadan) — JANGAN
              // cache sebagai "sudah cuba", supaya percubaan akan datang
              // masih boleh menjana semula, bukan buntu selama-lamanya.
              ;(genRes.data.translations || []).forEach(({ text, translated, found }) => {
                if (found) rememberTranslation(targetLang, text, translated)
              })
            } catch (_) { /* penjana tidak tersedia — kekal papar asal */ }
          }
        } catch (_) {}
      }

      applyCache()
      persistCache(cache.current)
    } finally {
      busy.current = false
      setTranslating(false)
    }
  }, [applyCache, isAdmin, rememberTranslation])

  const setLanguage = useCallback(async (code) => {
    if (code === currentLang.current) return
    persistLang(code)
    const leaving = currentLang.current
    if (code === BASE_LANG) {
      currentLang.current = BASE_LANG
      setLang(BASE_LANG)
      restoreAll(leaving)
    } else {
      restoreAll(leaving)
      currentLang.current = code
      setLang(code)
      await translatePage(code)
    }
  }, [translatePage, restoreAll])

  // Bahasa terpilih dipulihkan (di atas) dari localStorage semasa init state,
  // tetapi terjemahan DOM sebenar hanya boleh dilaksanakan selepas laman
  // pertama selesai render — jadi mula-mulakan sekali di sini.
  useEffect(() => {
    if (initialLang !== BASE_LANG) {
      const t = setTimeout(() => translatePage(initialLang), 300)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Banyak laman (Pengurusan Pengguna, Kes, Ingestion, dll.) memuatkan
  // kandungan secara ASINKRON (panggilan API selepas mount) — imbasan sekali
  // sahaja pada masa navigasi (useRouteTranslation, kelewatan tetap) terlepas
  // kandungan yang tiba lewat. MutationObserver di sini mengesan bila-bila
  // nod BAHARU dimasukkan ke DOM (cth. jadual selepas fetch selesai) dan
  // mencetuskan semakan semula. Hanya perhati `childList` (BUKAN
  // `characterData`) — applyCache() menukar textContent nod SEDIA ADA, jadi
  // ia tidak mencetuskan childList, mengelakkan gelung maklum balas tanpa
  // henti (terjemah teks yang baru sahaja diterjemah).
  const mutationDebounce = useRef(null)
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (currentLang.current === BASE_LANG) return
      clearTimeout(mutationDebounce.current)
      mutationDebounce.current = setTimeout(() => {
        applyCache()
        translatePage(currentLang.current)
      }, 250)
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => { observer.disconnect(); clearTimeout(mutationDebounce.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <LanguageContext.Provider value={{
      lang, languages: SUPPORTED_LANGUAGES, baseLang: BASE_LANG,
      setLanguage, translating, applyCache, translatePage, currentLang,
    }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)

// Hook untuk guna semula terjemahan selepas navigasi laluan — dipanggil di
// dalam konteks Router.
export function useRouteTranslation() {
  const location = useLocation()
  const { currentLang, applyCache, translatePage } = useContext(LanguageContext)

  useEffect(() => {
    if (currentLang.current === BASE_LANG) return
    // Kelewatan kecil supaya React selesai render laman baharu.
    const t = setTimeout(() => {
      applyCache()
      translatePage(currentLang.current)
    }, 400)
    return () => clearTimeout(t)
  }, [location.pathname])
}
