import { useState, useRef, useEffect } from 'react'

// Glossary of jargon terms → plain language explanations
export const GLOSSARY = {
  'rule_based': 'Kaedah klasifikasi menggunakan peraturan tetap yang diprogramkan — bukan AI learning. Pantas dan boleh dijangka hasilnya.',
  'static_template_fallback': 'Surat dijana menggunakan templat tetap kerana AI tidak berjaya jana secara automatik. Kandungan asas masih tepat.',
  'Isolation Forest': 'Algoritma machine learning untuk kesan data yang luar biasa (anomali). Nilai negatif bermakna anomali dikesan.',
  'DI': 'Discrepancy Index — ukuran perbezaan antara skor audit JN dengan data operasi sekolah. Skala 0.0 (tiada beza) hingga 1.0 (beza maksimum).',
  'Anomaly Score (IF)': 'Skor pengesanan anomali oleh Isolation Forest. Nilai negatif = anomali, positif = normal.',
  'SKPMG2': 'Standard Kualiti Pendidikan Malaysia Gelombang 2 — kerangka penilaian kualiti sekolah oleh JN merangkumi 5 domain utama.',
  'Confidence (ML)': 'Tahap keyakinan model AI dalam klasifikasinya. 100% = yakin sepenuhnya, 25% = tidak pasti.',
  'Confidence': 'Tahap keyakinan AI. Lebih tinggi % = AI lebih yakin dengan klasifikasi/keputusannya.',
  'DATA_ALIGNED': 'Skor sekolah selaras dengan audit JN — tiada discrepancy yang signifikan.',
  'EXTREME_DISCREPANCY': 'Perbezaan sangat kritikal (DI ≥ 0.75) — tindakan segera diperlukan.',
  'SEVERE_DISCREPANCY': 'Perbezaan teruk (DI 0.50–0.74) — perlu perhatian segera.',
  'MODERATE_DISCREPANCY': 'Perbezaan sederhana (DI 0.25–0.49) — perlu tindakan susulan.',
  'MINOR_DISCREPANCY': 'Perbezaan kecil (DI 0.10–0.24) — perlu pemantauan.',
  'jn_baseline': 'Data audit rasmi daripada Jemaah Nazir — digunakan sebagai rujukan utama untuk perbandingan.',
  'outsource': 'Data operasi daripada sistem luar (EMIS, APDM, laporan) — dibandingkan dengan skor JN untuk kira DI.',
  'payloadChecksum': 'Kod unik untuk sahkan integriti data — memastikan data tidak diubah sejak direkodkan.',
}

// Inline tooltip wrapper — wrap any text/term
export function GlossaryTip({ term, children }) {
  const explanation = GLOSSARY[term] || GLOSSARY[children]
  if (!explanation) return <>{children}</>
  return <Tooltip content={explanation}>{children}</Tooltip>
}

// Core tooltip component
export function Tooltip({ content, children, position = 'top' }) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords]   = useState({ top: 0, left: 0 })
  const triggerRef = useRef(null)
  const tipRef     = useRef(null)

  const show = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setCoords({ top: rect.top + window.scrollY, left: rect.left + rect.width / 2, bottom: rect.bottom + window.scrollY, width: rect.width })
    setVisible(true)
  }

  useEffect(() => {
    if (!visible) return
    const hide = () => setVisible(false)
    document.addEventListener('scroll', hide, true)
    return () => document.removeEventListener('scroll', hide, true)
  }, [visible])

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={() => setVisible(false)}
        style={{ borderBottom: '1px dashed #6366f1', cursor: 'help', display: 'inline' }}
      >
        {children}
      </span>
      {visible && (
        <div
          ref={tipRef}
          style={{
            position: 'fixed',
            top: coords.top - 8,
            left: coords.left,
            transform: 'translate(-50%, -100%)',
            zIndex: 9999,
            background: '#1e1b4b',
            color: '#e0e7ff',
            padding: '8px 13px',
            borderRadius: 8,
            fontSize: 12,
            maxWidth: 280,
            lineHeight: 1.55,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            pointerEvents: 'none',
          }}
        >
          {content}
          {/* Arrow */}
          <div style={{
            position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)',
            width: 10, height: 10, background: '#1e1b4b',
            clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
          }} />
        </div>
      )}
    </>
  )
}

// InfoIcon — small ⓘ badge that shows tooltip on hover
export function InfoTip({ content }) {
  return (
    <Tooltip content={content}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 15, height: 15, borderRadius: '50%',
        background: '#e0e7ff', color: '#4f46e5',
        fontSize: 10, fontWeight: 800, cursor: 'help',
        verticalAlign: 'middle', marginLeft: 4,
      }}>
        i
      </span>
    </Tooltip>
  )
}
