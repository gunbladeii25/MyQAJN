import { useState, useRef, useEffect } from 'react'
import { myraChat } from '../../services/api'

// ── Text-to-speech via backend proxy → Google Translate TTS (BM accent) ──
let currentAudio = null

function speak(text, onEnd) {
  // Stop any playing audio
  if (currentAudio) { currentAudio.pause(); currentAudio = null }

  const clean = text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FEFF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}\u{1F900}-\u{1F9FF}]/gu, '')
    .replace(/[*_#`~]/g, '')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)

  // Retrieve token from Zustand persisted store
  let token = ''
  try {
    const stored = JSON.parse(localStorage.getItem('auth-storage') || '{}')
    token = stored?.state?.token || localStorage.getItem('token') || ''
  } catch { token = '' }

  // Fetch audio blob through backend proxy (avoids CORS, carries auth)
  fetch(`/api/v1/chat/tts?text=${encodeURIComponent(clean)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(r => {
      if (!r.ok) throw new Error('TTS gagal')
      return r.blob()
    })
    .then(blob => {
      const url = URL.createObjectURL(blob)
      currentAudio = new Audio(url)
      currentAudio.playbackRate = 1.0
      currentAudio.onended = () => { URL.revokeObjectURL(url); currentAudio = null; onEnd?.() }
      currentAudio.onerror = () => { currentAudio = null; onEnd?.() }
      currentAudio.play()
    })
    .catch(() => onEnd?.())
}

function stopSpeak() {
  if (currentAudio) { currentAudio.pause(); currentAudio = null }
}

// ── Markdown-lite renderer ────────────────────────────────────────────────
function MsgText({ text }) {
  const lines = text.split('\n')
  return (
    <div style={{ fontSize: 13, lineHeight: 1.65 }}>
      {lines.map((line, i) => {
        // Bold: **text**
        const parts = line.split(/\*\*(.*?)\*\*/g)
        const rendered = parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)
        // Bullet
        if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
          return <div key={i} style={{ display: 'flex', gap: 6, marginTop: 3 }}><span>•</span><span>{rendered}</span></div>
        }
        return <div key={i} style={{ marginTop: i > 0 && line === '' ? 6 : 2 }}>{rendered}</div>
      })}
    </div>
  )
}

// ── Quick suggestion chips ────────────────────────────────────────────────
const QUICK_TIPS = [
  { label: '📥 Macam mana nak mula?',    msg: 'Macam mana nak mula guna sistem ni?' },
  { label: '📊 Apa itu DI?',            msg: 'Boleh terangkan apa itu Discrepancy Index (DI)?' },
  { label: '🔵 Fasa A vs Fasa B?',      msg: 'Apa beza Fasa A dan Fasa B dalam Ingestion Data?' },
  { label: '🚨 Tahap amaran RED?',       msg: 'Apa yang perlu buat kalau kes dalam tahap RED?' },
]

// ── Avatar SVG ───────────────────────────────────────────────────────────
const MyraAvatar = ({ size = 36, pulse = false }) => (
  <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
    {pulse && (
      <div style={{
        position: 'absolute', inset: -3,
        borderRadius: '50%', background: 'rgba(249,115,22,0.3)',
        animation: 'myra-pulse 1.5s ease-in-out infinite',
      }} />
    )}
    <svg width={size} height={size} viewBox="0 0 36 36" style={{ borderRadius: '50%', display: 'block' }}>
      <circle cx="18" cy="18" r="18" fill="url(#myraGrad)" />
      <defs>
        <radialGradient id="myraGrad" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#dc2626" />
        </radialGradient>
      </defs>
      {/* Tudung (hijab) — dome atas kepala + juntaian melepasi bahu */}
      <ellipse cx="18" cy="9" rx="8.5" ry="6" fill="#5b3a6b" />
      <ellipse cx="10.5" cy="18" rx="2.6" ry="9" fill="#5b3a6b" />
      <ellipse cx="25.5" cy="18" rx="2.6" ry="9" fill="#5b3a6b" />
      {/* Face (dilukis selepas tudung supaya "membingkai" wajah) */}
      <circle cx="18" cy="15" r="7" fill="#fde68a" />
      {/* Sentuhan lipatan halus untuk dimensi */}
      <ellipse cx="14.5" cy="6.5" rx="2.5" ry="1.5" fill="#7a4f89" opacity="0.4" />
      {/* Eyes */}
      <circle cx="15.5" cy="14.5" r="1.2" fill="#1e1b4b" />
      <circle cx="20.5" cy="14.5" r="1.2" fill="#1e1b4b" />
      {/* Smile */}
      <path d="M15 17.5 Q18 20 21 17.5" stroke="#92400e" strokeWidth="0.9" fill="none" strokeLinecap="round" />
      {/* Body */}
      <rect x="11" y="23" width="14" height="10" rx="4" fill="#f97316" />
      <text x="18" y="30" textAnchor="middle" fontSize="5" fill="#fff" fontWeight="bold">JN</text>
    </svg>
  </div>
)

// ── Main Myra Chat Widget ─────────────────────────────────────────────────
export default function MyraChat() {
  const [open, setOpen]       = useState(false)
  const [msgs, setMsgs]       = useState([
    { role: 'myra', text: 'Hai! 👋 Saya **Myra**, pembantu AI untuk sistem MyQA@JN!\n\nSaya boleh bantu anda faham cara guna sistem, istilah teknikal, atau aliran kerja. Apa yang boleh saya bantu hari ini? 😊' }
  ])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [speakId, setSpeakId] = useState(null)
  const [unread, setUnread]   = useState(1)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, open])

  useEffect(() => {
    if (open) { setUnread(0); setTimeout(() => inputRef.current?.focus(), 200) }
  }, [open])

  // Preload voices
  useEffect(() => {
    window.speechSynthesis?.getVoices()
    window.speechSynthesis?.addEventListener('voiceschanged', () => window.speechSynthesis.getVoices())
  }, [])

  const send = async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')

    const userMsg  = { role: 'user', text: msg }
    const nextMsgs = [...msgs, userMsg]
    setMsgs(nextMsgs)
    setLoading(true)

    try {
      const history = nextMsgs.slice(0, -1).map(m => ({ role: m.role, text: m.text }))
      const { data } = await myraChat(msg, history)
      const reply = { role: 'myra', text: data.reply }
      setMsgs(prev => [...prev, reply])
      if (!open) setUnread(n => n + 1)
    } catch {
      setMsgs(prev => [...prev, { role: 'myra', text: 'Maaf, ada masalah teknikal. Cuba lagi ya! 😊' }])
    } finally {
      setLoading(false)
    }
  }

  const handleSpeak = (id, text) => {
    if (speaking && speakId === id) {
      stopSpeak()
      setSpeaking(false); setSpeakId(null)
    } else {
      setSpeaking(true); setSpeakId(id)
      speak(text, () => { setSpeaking(false); setSpeakId(null) })
    }
  }

  return (
    <>
      <style>{`
        @keyframes myra-pulse { 0%,100% { transform: scale(1); opacity: 0.6 } 50% { transform: scale(1.2); opacity: 0.2 } }
        @keyframes myra-bounce { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
        @keyframes myra-fadein { from { opacity:0; transform: scale(0.95) translateY(10px) } to { opacity:1; transform: scale(1) translateY(0) } }
        .myra-msg-in { animation: myra-fadein 0.25s ease-out both }
        .myra-input:focus { outline: none; border-color: #f97316; box-shadow: 0 0 0 2px rgba(249,115,22,0.2) }
      `}</style>

      {/* Floating trigger button */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 2000 }}>
        {!open && (
          <div style={{ position: 'relative' }}>
            {unread > 0 && (
              <div style={{
                position: 'absolute', top: -4, right: -4, width: 20, height: 20,
                borderRadius: '50%', background: '#dc2626', color: '#fff',
                fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1, border: '2px solid #fff',
              }}>{unread}</div>
            )}
            <button
              onClick={() => setOpen(true)}
              title="Chat dengan Myra — Pembantu AI"
              style={{
                width: 58, height: 58, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)',
                boxShadow: '0 6px 24px rgba(249,115,22,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'myra-bounce 2.5s ease-in-out infinite',
              }}>
              <MyraAvatar size={40} />
            </button>
          </div>
        )}

        {/* Chat window */}
        {open && (
          <div style={{
            width: 360, height: 560,
            background: '#fff', borderRadius: 18,
            boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            animation: 'myra-fadein 0.25s ease-out both',
          }}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)',
              padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10,
              flexShrink: 0,
            }}>
              <MyraAvatar size={38} pulse={loading} />
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>Myra</div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>
                  {loading ? '✍️ sedang menaip…' : '🟢 Online — Pembantu MyQA@JN'}
                </div>
              </div>
              <button onClick={() => setOpen(false)} style={{
                background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8,
                padding: '5px 8px', cursor: 'pointer', color: '#fff', fontSize: 16, lineHeight: 1,
              }}>✕</button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {msgs.map((m, i) => (
                <div key={i} className="myra-msg-in" style={{
                  display: 'flex', gap: 8, flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                  alignItems: 'flex-end',
                }}>
                  {m.role === 'myra' && <MyraAvatar size={26} />}
                  <div style={{
                    maxWidth: '78%',
                    background: m.role === 'myra' ? '#f9fafb' : 'linear-gradient(135deg, #f97316, #dc2626)',
                    color: m.role === 'myra' ? '#111827' : '#fff',
                    padding: '9px 12px', borderRadius: m.role === 'myra' ? '14px 14px 14px 4px' : '14px 14px 4px 14px',
                    border: m.role === 'myra' ? '1px solid #f3f4f6' : 'none',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                  }}>
                    <MsgText text={m.text} />
                    {m.role === 'myra' && (
                      <button
                        onClick={() => handleSpeak(i, m.text)}
                        title={speaking && speakId === i ? 'Henti suara' : 'Dengar suara Myra'}
                        style={{
                          marginTop: 6, background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: 14, opacity: 0.6, padding: 0,
                          color: speaking && speakId === i ? '#f97316' : '#6b7280',
                        }}>
                        {speaking && speakId === i ? '🔊' : '🔈'}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <MyraAvatar size={26} />
                  <div style={{ background: '#f3f4f6', borderRadius: '14px 14px 14px 4px', padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {[0,1,2].map(j => (
                        <div key={j} style={{
                          width: 7, height: 7, borderRadius: '50%', background: '#f97316',
                          animation: `myra-bounce 1s ease-in-out ${j * 0.2}s infinite`,
                        }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Quick chips — only show on first message */}
            {msgs.length <= 1 && (
              <div style={{ padding: '0 12px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {QUICK_TIPS.map((q, i) => (
                  <button key={i} onClick={() => send(q.msg)} style={{
                    fontSize: 11, padding: '5px 10px', borderRadius: 20,
                    border: '1px solid #fed7aa', background: '#fff7ed',
                    color: '#9a3412', cursor: 'pointer', fontWeight: 500,
                  }}>
                    {q.label}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div style={{
              padding: '10px 12px 14px', borderTop: '1px solid #f3f4f6',
              display: 'flex', gap: 8, flexShrink: 0,
            }}>
              <input
                ref={inputRef}
                className="myra-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder="Tanya Myra sesuatu…"
                style={{
                  flex: 1, padding: '9px 13px', borderRadius: 22,
                  border: '1.5px solid #e5e7eb', fontSize: 13, background: '#fafafa',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                style={{
                  width: 38, height: 38, borderRadius: '50%', border: 'none',
                  background: input.trim() ? 'linear-gradient(135deg, #f97316, #dc2626)' : '#f3f4f6',
                  color: input.trim() ? '#fff' : '#9ca3af',
                  cursor: input.trim() ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, flexShrink: 0, transition: 'background 0.15s',
                }}>
                ➤
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
