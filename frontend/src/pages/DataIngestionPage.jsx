import { useState, useEffect, useCallback } from 'react'
import {
  getIngestionSources, triggerPull, uploadIngestionDocument,
  getIngestionRuns, getIngestionRecords,
  approveIngestionRecord, rejectIngestionRecord, getSchools,
  getGdriveFiles, getMappingPreview,
} from '../services/api'
import Spinner, { PageLoader } from '../components/ui/Spinner'

// ── Colour helpers ─────────────────────────────────────────────────────────
// `tone` maps to a MYDS semantic scale; TONE_CLASSES holds full literal class
// strings (not interpolated) so Tailwind's content scanner can pick them up.
// `hex` is kept only for one-off inline accents (e.g. Card borderLeft) that
// can't be expressed as a className.
const TONE_CLASSES = {
  success: 'bg-success-100 text-success-700',
  danger:  'bg-danger-100 text-danger-700',
  warning: 'bg-warning-100 text-warning-700',
  primary: 'bg-primary-100 text-primary-700',
  gray:    'bg-gray-100 text-gray-700',
}
const TONE_HEX = {
  success: '#16A34A', danger: '#DC2626', warning: '#CA8A04', primary: '#2563EB', gray: '#3F3F46',
}

const DI_BADGE = {
  EXTREME_DISCREPANCY:  { tone: 'danger',  label: 'EXTREME'  },
  SEVERE_DISCREPANCY:   { tone: 'danger',  label: 'SEVERE'   },
  MODERATE_DISCREPANCY: { tone: 'warning', label: 'SEDERHANA'},
  MINOR_DISCREPANCY:    { tone: 'primary', label: 'MINOR'    },
  DATA_ALIGNED:         { tone: 'success', label: 'SEJAJAR'  },
}
const diBadge = (cls) => DI_BADGE[cls] || { tone: 'gray', label: cls || '—' }

const STATUS_BADGE = {
  pending:      { tone: 'warning', label: 'Menunggu' },
  approved:     { tone: 'success', label: 'Diluluskan' },
  rejected:     { tone: 'danger',  label: 'Ditolak' },
  case_created: { tone: 'primary', label: 'Kes Dicipta' },
  error:        { tone: 'danger',  label: 'Ralat' },
}
const statusBadge = (s) => STATUS_BADGE[s] || { tone: 'gray', label: s }

const Badge = ({ tone = 'gray', label }) => (
  <span className={`rounded-full text-xs font-semibold px-2.5 py-0.5 ${TONE_CLASSES[tone] || TONE_CLASSES.gray}`}>
    {label}
  </span>
)

const Card = ({ children, style = {}, className = '' }) => (
  <div className={`card p-5 ${className}`} style={style}>
    {children}
  </div>
)

function Modal({ children, onClose }) {
  return (
    <div onClick={onClose} className="fixed inset-0 z-[1000] flex items-center justify-center p-5 bg-gray-900/40 backdrop-blur-sm">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-lg p-6 max-w-[440px] w-full shadow-menu">
        {children}
      </div>
    </div>
  )
}

// School picker shared component
function SchoolPicker({ schools, selected, onToggle, onSelectAll, onClearAll }) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(null)   // school id dengan pecahan standard terbuka
  const filtered = schools.filter(s =>
    !search || s.schoolName.toLowerCase().includes(search.toLowerCase()) ||
    s.schoolCode.toLowerCase().includes(search.toLowerCase())
  )
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>
          Pilih Sekolah
          {selected.length > 0 && <span style={{ marginLeft: 8, color: '#2563EB' }}>({selected.length} dipilih)</span>}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onSelectAll(filtered.map(s => s.id))}
            className="text-xs font-medium px-3 py-1 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">Pilih Semua</button>
          <button onClick={onClearAll}
            className="text-xs font-medium px-3 py-1 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">Nyahpilih</button>
        </div>
      </div>
      <input placeholder="Cari sekolah…" value={search} onChange={e => setSearch(e.target.value)}
        className="input mb-2" />
      <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filtered.map(s => {
          const breakdown = s.jnDomainBreakdown || []
          const isOpen = expanded === s.id
          // Susun ikut urutan standard SKPM rasmi; domain bukan-SKPM
          // (cth. SKPK pra-sekolah) dipaparkan selepasnya guna label DB.
          const ordered = [
            ...SKPM_STANDARDS.map(std => breakdown.find(d => d.domain === std.key)).filter(Boolean),
            ...breakdown.filter(d => !DOMAIN_LABELS[d.domain]),
          ]
          return (
            <div key={s.id} style={{
              borderRadius: 7,
              background: selected.includes(s.id) ? '#EFF6FF' : '#FAFAFA',
              border: selected.includes(s.id) ? '1px solid #96B7FF' : '1px solid transparent',
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={selected.includes(s.id)} onChange={() => onToggle(s.id)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{s.schoolName}</div>
                  <div style={{ fontSize: 11, color: '#A1A1AA' }}>
                    {s.schoolCode} · {s.schoolType} · {s.state}
                    {s.jnAuditScore != null && <span style={{ color: '#2563EB' }}> · Skor JN semasa: <strong>{s.jnAuditScore}</strong></span>}
                  </div>
                </div>
                {ordered.length > 0 && (
                  <button
                    onClick={e => { e.preventDefault(); e.stopPropagation(); setExpanded(isOpen ? null : s.id) }}
                    title="Lihat pecahan skor per standard SKPM"
                    className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 border ${
                      isOpen ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-300 bg-white text-gray-500'
                    }`}>
                    {isOpen ? '▾' : '▸'} {ordered.length} standard
                  </button>
                )}
              </label>
              {isOpen && (
                <div style={{ padding: '0 10px 10px 34px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    {ordered.map(d => (
                      <div key={d.domain} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                        padding: '4px 10px', borderRadius: 6, background: '#fff', border: '1px solid #E4E4E7',
                      }}>
                        <span style={{ fontSize: 11, color: '#52525B' }}>{DOMAIN_LABELS[d.domain] || d.domainLabel}</span>
                        <strong style={{ fontSize: 12, color: '#1D4ED8' }}>{d.domainScore?.toFixed(1)}</strong>
                      </div>
                    ))}
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 10.5, color: '#A1A1AA' }}>
                    Tempoh audit: {ordered[0]?.auditPeriod} · Skor JN semasa = purata berwajaran standard di atas.
                  </p>
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && <p style={{ color: '#A1A1AA', fontSize: 13, padding: '12px 0', textAlign: 'center' }}>Tiada sekolah dijumpai.</p>}
      </div>
    </div>
  )
}

// Standard/domain SKPM untuk tarikan separa SK@S.
// `key` MESTI sepadan dengan kunci SKPM_DOMAINS (ai-engine/ingestion/skpm_structure.py)
// dan kolum JnDomainScore.domain dalam DB.
const SKPM_STANDARDS = [
  { key: 'kekuatan',               label: 'Kekuatan (Prasarana & Sumber)' },
  { key: 'kepimpinan',             label: 'Kepemimpinan (Standard 1)' },
  { key: 'pengurusan_organisasi',  label: 'Pengurusan Organisasi (Standard 2)' },
  { key: 'pengurusan_kurikulum',   label: 'Pengurusan Kurikulum (Standard 3.1)' },
  { key: 'pengurusan_kokurikulum', label: 'Pengurusan Kokurikulum (Standard 3.2)' },
  { key: 'pengurusan_hem',         label: 'Pengurusan Hal Ehwal Murid (Standard 3.3)' },
  { key: 'pdpc',                   label: 'Pembelajaran dan Pemudahcaraan (Standard 4)' },
  { key: 'kemenjadian_murid',      label: 'Kemenjadian Murid, Guru & Sekolah (Standard 5)' },
]
const ALL_DOMAIN_KEYS = SKPM_STANDARDS.map(d => d.key)
const DOMAIN_LABELS = Object.fromEntries(SKPM_STANDARDS.map(d => [d.key, d.label]))

// ══════════════════════════════════════════════════════════════════════════
// TAB A — Fasa A: Kemaskini Baseline JN
// ══════════════════════════════════════════════════════════════════════════
function JNBaselineTab({ schools, selSchools, setSelSchools, onDone }) {
  const [sources, setSources]     = useState([])
  const [selSource, setSelSource] = useState(null)
  const [file, setFile]           = useState(null)
  const [pulling, setPulling]     = useState(false)
  const [result, setResult]       = useState(null)
  const [error, setError]         = useState('')
  const [selDomains, setSelDomains] = useState(ALL_DOMAIN_KEYS)

  // GDrive file listing
  const [gdriveFiles, setGdriveFiles] = useState([])
  const [gdriveLoading, setGdriveLoading] = useState(false)
  const [selGdriveFile, setSelGdriveFile] = useState(null)  // file yang dipilih user

  const isSKAS = selSource?.sourceCode === 'SKAS'
  const isPemeriksaan = selSource?.sourceCode === 'PEMERIKSAAN_JN'
  const isPartialPull = isSKAS && selDomains.length < ALL_DOMAIN_KEYS.length

  useEffect(() => {
    getIngestionSources().then(r => {
      setSources(r.data.sources.filter(s => s.sourceCategory === 'jn_baseline' && s.isActive))
    }).catch(() => {})
  }, [])

  // Fetch GDrive files when Pemeriksaan JN is selected
  useEffect(() => {
    if (isPemeriksaan) {
      setGdriveLoading(true); setSelGdriveFile(null)
      getGdriveFiles(new Date().getFullYear())
        .then(r => setGdriveFiles(r.data.files || []))
        .catch(() => setGdriveFiles([]))
        .finally(() => setGdriveLoading(false))
    } else {
      setGdriveFiles([]); setSelGdriveFile(null)
    }
  }, [isPemeriksaan])

  const handlePull = async () => {
    if (!selSource) return setError('Sila pilih sumber JN baseline.')
    if (selSchools.length === 0) return setError('Sila pilih sekurang-kurangnya satu sekolah.')
    // Pemeriksaan JN: WAJIB pilih fail dari senarai GDrive dulu
    if (isPemeriksaan && !selGdriveFile && !file) return setError('Sila pilih satu fail syor dari senarai Google Drive atau muat naik fail.')
    if (selSource.sourceType === 'document' && !isPemeriksaan && !file) return setError('Sila pilih fail dokumen pemeriksaan JN.')
    if (isSKAS && selDomains.length === 0) return setError('Sila pilih sekurang-kurangnya satu standard SKPM.')
    setError(''); setPulling(true); setResult(null)
    try {
      let r
      if (selSource.sourceType === 'document' && file) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('sourceId', selSource.id)
        fd.append('schoolIds', JSON.stringify(selSchools))
        r = await uploadIngestionDocument(selSource.id, fd)
      } else {
        r = await triggerPull(selSource.id, {
          schoolIds: selSchools,
          ...(isSKAS && { domains: selDomains }),
          ...(isPemeriksaan && selGdriveFile && { gdriveFileIds: [selGdriveFile.id] }),
        })
      }
      setResult(r.data)
      if (r.data?.runCategory === 'jn_baseline' && r.data?.schoolsUpdated > 0) {
        setTimeout(() => onDone(), 2200)
      }
    } catch (e) {
      setError(e.response?.data?.error || 'Gagal mengemaskini JN baseline.')
    } finally {
      setPulling(false)
    }
  }

  return (
    <div>
      {/* Info banner */}
      <div style={{ background: '#EFF6FF', border: '1px solid #C2D5FF', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 12 }}>
        <span style={{ fontSize: 20 }}>🔵</span>
        <div>
          <p style={{ margin: 0, fontWeight: 700, color: '#1E40AF', fontSize: 14 }}>Fasa A — Kemaskini Data Audit JN (Baseline)</p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#3A75F6' }}>
            Tarik skor audit SKPMG2 daripada SK@S, SKPK, atau dokumen Pemeriksaan JN.
            Nilai ini akan dikemaskini terus ke <strong>School.jnAuditScore</strong> — tiada semakan diperlukan.
            Lakukan Fasa A terlebih dahulu sebelum tarik data luar (Fasa B).
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
        {/* LEFT: Source selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>1. Pilih Sumber JN</h4>
            {sources.length === 0
              ? <p style={{ fontSize: 13, color: '#A1A1AA' }}>Tiada sumber JN baseline aktif.</p>
              : sources.map(s => (
                <button key={s.id} onClick={() => { setSelSource(s); setResult(null); setFile(null); setError('') }} style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8,
                  cursor: 'pointer', marginBottom: 8,
                  border: selSource?.id === s.id ? '2px solid #2563EB' : '1px solid #E4E4E7',
                  background: selSource?.id === s.id ? '#EFF6FF' : '#fff',
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: selSource?.id === s.id ? '#1E40AF' : '#18181B' }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 2 }}>
                    {s.sourceType === 'api' ? '🔌 API Endpoint' : '📄 Dokumen (Google Drive)'} · {s.sourceCode}
                  </div>
                  {s.description && (
                    <div style={{ fontSize: 12, color: '#52525B', marginTop: 6, lineHeight: 1.4 }}>
                      {s.description}
                    </div>
                  )}
                </button>
              ))
            }
          </Card>

          {selSource?.sourceCode === 'SKPK' && (
            <div style={{ background: '#FEFCE8', border: '1px solid #FDE047', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#854D0E', lineHeight: 1.5 }}>
              🧸 <strong>Instrumen SKPK (pra-sekolah)</strong> — menggunakan set standard tersendiri,
              bukan standard SKPM. Skor per standard SKPK akan disimpan dan dipaparkan dalam
              pecahan sekolah. <em>Struktur standard semasa adalah placeholder — akan digantikan
              dengan borang SKPK rasmi.</em>
            </div>
          )}

          {isPemeriksaan && (
            <div style={{ background: '#EFF6FF', border: '1px solid #C2D5FF', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#1E40AF', lineHeight: 1.5 }}>
              📜 <strong>Dokumen Syor Pemeriksaan JN</strong> — laluan utama:
              sistem <strong>tarik terus dari folder Google Drive</strong> rasmi.
              Dokumen lazimnya dalam format <strong>DOCX</strong> dan mengandungi
              <strong>pelaporan pukal (bulk)</strong> — satu fail meliputi
              pelbagai sekolah, disusun mengikut tema pemeriksaan yang ditentukan
              oleh Top Management (cth. Pemeriksaan PAJSK, Pemeriksaan Kurikulum,
              Pemeriksaan PPD).
              <br /><br />
              <strong>🤖 AI Agent 0</strong> akan membaca kandungan dokumen,
              <strong>mengenal pasti kod sekolah secara dinamik</strong> dari teks,
              dan menukar pernyataan syor kepada skor per standard SKPM.
              <em>Tiada lagi kebergantungan pada konvensyen nama fail.</em>
              <br /><br />
              Pernyataan syor yang telah di-endorse dianalisis oleh AI dan ditukar
              kepada skor per standard SKPM. Satu dokumen lazimnya meliputi
              <strong>sebahagian standard sahaja</strong> — komposit digabung dengan
              standard sedia ada. Muat naik manual hanya diperlukan jika dokumen
              belum ada dalam folder Drive.
            </div>
          )}

          {/* ── GDrive File List (Pemeriksaan JN sahaja) ─────────────────── */}
          {isPemeriksaan && (
            <Card>
              <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700 }}>
                📂 Fail dalam Google Drive
                {gdriveFiles.length > 0 && (
                  <span style={{ marginLeft: 8, color: '#2563EB', fontWeight: 600, fontSize: 12 }}>
                    ({gdriveFiles.length} fail)
                  </span>
                )}
              </h4>
              {gdriveLoading ? (
                <p className="text-sm text-gray-400 py-2.5 flex items-center gap-2"><Spinner size="sm" /> Menyenaraikan fail…</p>
              ) : gdriveFiles.length === 0 ? (
                <div style={{ background: '#FEFCE8', border: '1px solid #FEF08A', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#854D0E' }}>
                  ⚠️ Tiada fail dijumpai dalam folder Google Drive untuk tahun semasa.
                  <br />Sila muat naik fail DOCX pemeriksaan secara manual.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                  {gdriveFiles.map((gf) => {
                    const isSel = selGdriveFile?.id === gf.id
                    return (
                      <div key={gf.id}
                        onClick={() => setSelGdriveFile(isSel ? null : gf)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                          background: isSel ? '#EFF6FF' : gf.isDocx ? '#F0FDF4' : '#FAFAFA',
                          border: isSel ? '2px solid #2563EB' : gf.isDocx ? '1px solid #BBF7D0' : '1px solid #E4E4E7',
                          transition: 'all 0.15s',
                        }}
                      >
                        <span style={{
                          width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                          border: isSel ? '5px solid #2563EB' : '2px solid #D4D4D8',
                          background: isSel ? '#fff' : 'transparent',
                          transition: 'all 0.15s',
                        }} />
                        <span style={{ fontSize: 18, flexShrink: 0 }}>
                          {gf.isDocx ? '📄' : '📎'}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: isSel ? '#1E40AF' : '#27272A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {gf.name}
                          </div>
                          <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 1 }}>
                            {gf.theme && gf.theme !== 'Umum' && (
                              <span style={{
                                background: '#DBEAFE', color: '#1D4ED8', padding: '1px 6px',
                                borderRadius: 4, marginRight: 6, fontWeight: 600,
                              }}>📋 {gf.theme}</span>
                            )}
                            {gf.size > 0 && <span>{(gf.size / 1024).toFixed(1)} KB</span>}
                          </div>
                        </div>
                        {gf.webViewLink && (
                          <a href={gf.webViewLink} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ fontSize: 11, color: '#2563EB', textDecoration: 'none', flexShrink: 0, fontWeight: 600 }}>
                            Buka ↗
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              <p style={{ margin: '10px 0 0', fontSize: 11, color: '#A1A1AA' }}>
                {selGdriveFile
                  ? <>✅ <strong>{selGdriveFile.name}</strong> dipilih — AI akan analisa kandungan fail ini.</>
                  : <>👆 Pilih satu fail di atas. AI akan membaca kandungan dan mengesan kod sekolah secara automatik.</>
                }
              </p>
            </Card>
          )}

          {selSource?.sourceType === 'document' && (
            <Card>
              <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700 }}>
                2. Muat Naik Dokumen{isPemeriksaan && <span style={{ color: '#A1A1AA', fontWeight: 500 }}> (Pilihan)</span>}
              </h4>
              {isPemeriksaan && file && (
                <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => setFile(null)}
                    className="text-xs font-medium px-3 py-1 rounded-md border border-danger-300 bg-white text-danger-800 hover:bg-danger-50">
                    ✕ Buang fail — guna Google Drive
                  </button>
                </div>
              )}
              <label style={{
                display: 'block', border: '2px dashed #96B7FF', borderRadius: 8,
                padding: 20, textAlign: 'center', cursor: 'pointer', background: '#EFF6FF',
              }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>📋</div>
                <div style={{ fontSize: 13, color: '#3F3F46' }}>
                  {file ? <span style={{ color: '#1D4ED8' }}>✅ {file.name}</span> : 'Klik atau seret fail pemeriksaan JN (DOCX/PDF)'}
                </div>
                <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 4 }}>DOCX, PDF, XLSX (maks 20MB) · Satu fail boleh mengandungi pelbagai sekolah</div>
                <input type="file" style={{ display: 'none' }} accept=".pdf,.docx,.xlsx,.xls,.txt"
                  onChange={e => setFile(e.target.files[0])} />
              </label>
            </Card>
          )}
        </div>

        {/* RIGHT: Standard picker (SKAS) + school picker + action */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isSKAS && (
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                  2. Pilih Standard SKPM
                  <span style={{ marginLeft: 8, color: isPartialPull ? '#2563EB' : '#A1A1AA', fontWeight: 600, fontSize: 12 }}>
                    ({selDomains.length}/{ALL_DOMAIN_KEYS.length} dipilih)
                  </span>
                </h4>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setSelDomains(ALL_DOMAIN_KEYS)}
                    className="text-xs font-medium px-3 py-1 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">Pilih Semua</button>
                  <button onClick={() => setSelDomains([])}
                    className="text-xs font-medium px-3 py-1 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">Nyahpilih</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {SKPM_STANDARDS.map(d => (
                  <label key={d.key} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 7, cursor: 'pointer',
                    fontSize: 12.5, fontWeight: 500,
                    background: selDomains.includes(d.key) ? '#EFF6FF' : '#FAFAFA',
                    border: selDomains.includes(d.key) ? '1px solid #96B7FF' : '1px solid transparent',
                  }}>
                    <input type="checkbox" checked={selDomains.includes(d.key)}
                      onChange={() => setSelDomains(p => p.includes(d.key) ? p.filter(x => x !== d.key) : [...p, d.key])} />
                    {d.label}
                  </label>
                ))}
              </div>
              {isPartialPull && (
                <p style={{ margin: '10px 0 0', fontSize: 11.5, color: '#6B6B74', lineHeight: 1.5 }}>
                  ℹ️ Tarikan separa: hanya standard dipilih akan dikemaskini.
                  Skor komposit JN dikira semula merangkumi skor standard sedia ada dalam pangkalan data (tempoh audit sama).
                </p>
              )}
            </Card>
          )}

          <Card>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>
              {selSource?.sourceType === 'api' && !isSKAS ? '2' : '3'}. Pilih Sekolah
            </h4>
            <SchoolPicker
              schools={schools}
              selected={selSchools}
              onToggle={id => setSelSchools(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
              onSelectAll={ids => setSelSchools(ids)}
              onClearAll={() => setSelSchools([])}
            />
          </Card>

          {error && <div className="bg-danger-100 text-danger-800 rounded-md px-3.5 py-2.5 text-sm">{error}</div>}

          <button
            disabled={pulling || !selSource || selSchools.length === 0 || (isSKAS && selDomains.length === 0) || (isPemeriksaan && !selGdriveFile && !file)}
            onClick={handlePull}
            className="btn-primary !px-6 !py-3 !text-sm w-full sm:w-auto">
            {pulling ? '⏳ Sedang kemaskini JN baseline…'
              : isPemeriksaan && !selGdriveFile && !file ? '👆 Pilih fail syor di atas dahulu'
              : isPemeriksaan ? (selGdriveFile ? `🔵 Tarik Syor dari ${selGdriveFile.name.slice(0, 25)}…` : '🔵 Tarik Syor dari Google Drive')
              : isPartialPull ? `🔵 Kemaskini Skor Audit JN (${selDomains.length} standard)`
              : '🔵 Kemaskini Skor Audit JN'}
          </button>

          {result && result.runCategory === 'jn_baseline' && (
            <Card className={result.schoolsUpdated > 0 ? 'border-primary-300 bg-primary-50' : 'border-danger-300 bg-danger-50'}>
              <div style={{ fontWeight: 700, color: result.schoolsUpdated > 0 ? '#1E40AF' : '#991B1B', marginBottom: 10 }}>
                {result.schoolsUpdated > 0
                  ? `✅ ${result.schoolsUpdated} sekolah berjaya dikemaskini!`
                  : '⚠️ Tiada sekolah dikemaskini'}
              </div>
              {(result.failedSchools || []).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: (result.schools || []).length > 0 ? 10 : 0 }}>
                  {result.failedSchools.map(f => (
                    <div key={f.schoolCode} style={{ padding: '8px 12px', background: '#fff', borderRadius: 8, border: '1px solid #FECACA' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#991B1B' }}>{f.schoolName || f.schoolCode}</div>
                      <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 2 }}>{f.error}</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(result.schools || []).map(s => (
                  <div key={s.schoolCode} style={{ padding: '8px 12px', background: '#fff', borderRadius: 8, border: '1px solid #C2D5FF' }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.schoolName || s.schoolCode}</div>
                    <div style={{ fontSize: 12, color: '#3A75F6', marginTop: 2 }}>
                      Skor JN Baharu: <strong style={{ fontSize: 14, color: '#1E40AF' }}>{s.jnAuditScore?.toFixed(2)}</strong>
                      {s.partial && (
                        <span style={{ marginLeft: 8, background: '#DBEAFE', color: '#1E40AF', padding: '1px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600 }}>
                          Separa — komposit termasuk standard sedia ada
                        </span>
                      )}
                    </div>
                    {(s.sourceFile || s.inspectionTheme) && (
                      <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 2 }}>
                        {s.inspectionTheme && (
                          <span style={{ marginRight: 10, background: '#DBEAFE', color: '#1D4ED8', padding: '1px 6px', borderRadius: 4 }}>
                            📋 {s.inspectionTheme}
                          </span>
                        )}
                        {s.sourceFile && <span>{s.sourceFile}</span>}
                      </div>
                    )}
                    {Object.keys(s.domainScores || s.dimensionScores || {}).length > 0 && (
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                        {Object.entries(s.domainScores || s.dimensionScores).map(([dim, val]) => {
                          const score = (val && typeof val === 'object') ? val.score : val
                          const label = (val && typeof val === 'object' && val.label)
                            ? val.label
                            : dim.replace('domain_', '').replace(/_/g, ' ')
                          if (score == null) return null
                          return (
                            <span key={dim} style={{ fontSize: 11, color: '#6B6B74' }}>
                              {label}: <strong>{score}</strong>
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {result.schoolsUpdated > 0 && (
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-600 rounded-full" style={{ animation: 'progress-fill 2.2s linear forwards' }} />
                  </div>
                  <span style={{ fontSize: 12, color: '#3A75F6', whiteSpace: 'nowrap' }}>
                    ⏩ Beralih ke Fasa B…
                  </span>
                </div>
              )}
              <style>{`@keyframes progress-fill { from { width: 0% } to { width: 100% } }`}</style>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// TAB B — Fasa B: Data Luar (Perbandingan)
// ══════════════════════════════════════════════════════════════════════════
function OutsourceTab({ schools, selSchools, setSelSchools, onRecordsCreated }) {
  const [sources, setSources]     = useState([])
  const [selSource, setSelSource] = useState(null)
  const [file, setFile]           = useState(null)
  const [pulling, setPulling]     = useState(false)
  const [result, setResult]       = useState(null)
  const [error, setError]         = useState('')

  // Mapping preview
  const [mappingPreview, setMappingPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    getIngestionSources().then(r => {
      setSources(r.data.sources.filter(s => s.sourceCategory === 'outsource' && s.isActive))
    }).catch(() => {})
  }, [])

  // Fetch mapping preview when source or schools change
  useEffect(() => {
    if (selSource && selSchools.length > 0) {
      setPreviewLoading(true); setMappingPreview(null)
      const codes = schools.filter(s => selSchools.includes(s.id)).map(s => s.schoolCode)
      getMappingPreview(selSource.sourceCode, codes)
        .then(r => setMappingPreview(r.data))
        .catch(() => setMappingPreview(null))
        .finally(() => setPreviewLoading(false))
    } else {
      setMappingPreview(null)
    }
  }, [selSource, selSchools])

  const handlePull = async () => {
    if (!selSource) return setError('Sila pilih sumber data luar.')
    if (selSchools.length === 0) return setError('Sila pilih sekurang-kurangnya satu sekolah.')
    if (selSource.sourceType === 'document' && !file) return setError('Sila pilih fail dokumen.')
    setError(''); setPulling(true); setResult(null)
    try {
      let r
      if (selSource.sourceType === 'document') {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('sourceId', selSource.id)
        fd.append('schoolIds', JSON.stringify(selSchools))
        r = await uploadIngestionDocument(selSource.id, fd)
      } else {
        r = await triggerPull(selSource.id, { schoolIds: selSchools })
      }
      setResult(r.data)
      if (r.data?.records > 0) onRecordsCreated()
    } catch (e) {
      setError(e.response?.data?.error || 'Gagal menarik data luar.')
    } finally {
      setPulling(false)
    }
  }

  // Check if any school has jnAuditScore
  const schoolsWithJn = schools.filter(s => s.jnAuditScore != null)
  const jnCoverage = schools.length > 0 ? Math.round((schoolsWithJn.length / schools.length) * 100) : 0

  return (
    <div>
      {/* Info banner */}
      <div style={{ background: '#FEFCE8', border: '1px solid #FEF08A', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 12 }}>
        <span style={{ fontSize: 20 }}>🟠</span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 700, color: '#854D0E', fontSize: 14 }}>Fasa B — Data Luar untuk Perbandingan DI</p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#A16207' }}>
            Tarik data operasi dari EMIS, APDM, atau laporan JPN/PPD. Sistem akan kira
            <strong> DI = |jnAuditScore − skor_ops| / 100</strong> bagi setiap sekolah.
            Rekod akan disimpan untuk semakan pegawai sebelum kes dijanakan.
          </p>
          <div style={{ marginTop: 8, fontSize: 12, color: '#854D0E' }}>
            📊 Liputan JN Baseline: <strong>{schoolsWithJn.length}/{schools.length} sekolah ({jnCoverage}%)</strong> telah ada skor JN.
            {jnCoverage < 80 && <span style={{ marginLeft: 8, color: '#DC2626' }}>⚠ Kemaskini Fasa A dahulu untuk liputan yang lebih baik.</span>}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>1. Pilih Sumber Data Luar</h4>
            {sources.map(s => (
              <button key={s.id} onClick={() => { setSelSource(s); setResult(null); setFile(null); setError('') }} style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8,
                cursor: 'pointer', marginBottom: 8,
                border: selSource?.id === s.id ? '2px solid #CA8A04' : '1px solid #E4E4E7',
                background: selSource?.id === s.id ? '#FEFCE8' : '#fff',
              }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: selSource?.id === s.id ? '#854D0E' : '#18181B' }}>{s.name}</div>
                <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 2 }}>
                  {s.sourceType === 'api' ? '🔌 API' : '📄 Dokumen'} · {s.sourceCode}
                </div>
                {s.description && (
                  <div style={{ fontSize: 12, color: '#52525B', marginTop: 6, lineHeight: 1.4 }}>
                    {s.description}
                  </div>
                )}
              </button>
            ))}
          </Card>

          {selSource?.sourceType === 'document' && (
            <Card>
              <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700 }}>2. Muat Naik Dokumen</h4>
              <label style={{
                display: 'block', border: '2px dashed #FEF08A', borderRadius: 8,
                padding: 20, textAlign: 'center', cursor: 'pointer', background: '#FEFCE8',
              }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>📎</div>
                <div style={{ fontSize: 13, color: '#3F3F46' }}>
                  {file ? <span style={{ color: '#854D0E' }}>✅ {file.name}</span> : 'Klik atau seret fail laporan'}
                </div>
                <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 4 }}>PDF, DOCX, Excel (maks 20MB)</div>
                <input type="file" style={{ display: 'none' }} accept=".pdf,.docx,.xlsx,.xls,.txt"
                  onChange={e => setFile(e.target.files[0])} />
              </label>
            </Card>
          )}
        </div>

        {/* RIGHT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>
              {selSource?.sourceType === 'api' ? '2' : '3'}. Pilih Sekolah
            </h4>
            <SchoolPicker
              schools={schools}
              selected={selSchools}
              onToggle={id => setSelSchools(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
              onSelectAll={ids => setSelSchools(ids)}
              onClearAll={() => setSelSchools([])}
            />
          </Card>

          {/* ── Mapping Preview ────────────────────────────────────────── */}
          {previewLoading && (
            <Card className="border-warning-300 bg-warning-50">
              <p className="text-sm text-warning-800 flex items-center gap-2 m-0"><Spinner size="sm" /> Menganalisis keserasian data...</p>
            </Card>
          )}
          {mappingPreview && !previewLoading && (
            <Card className="border-primary-200 bg-primary-50">
              <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#1E40AF' }}>
                📊 Keserasian Data: {mappingPreview.source_label} ↔ JN Baseline
              </h4>
              {mappingPreview.schools?.map(school => (
                <div key={school.school_code} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1E3A8A' }}>{school.school_code}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                      school.coverage_status === 'good' ? 'bg-success-100 text-success-700'
                        : school.coverage_status === 'partial' ? 'bg-warning-100 text-warning-700'
                        : 'bg-danger-100 text-danger-700'
                    }`}>
                      {school.coverage_pct}% sepadan
                    </span>
                    <span style={{ fontSize: 10, color: '#A1A1AA' }}>
                      ({school.jn_domain_count} standard JN ada baseline)
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {school.mapped_dimensions?.map(dim => (
                      <div key={dim.dimension} title={`${dim.dimension_label}: ${dim.outsource_fields.join(', ')}`}
                        className={`px-2 py-0.5 rounded-sm text-[10.5px] border ${
                          dim.has_jn_baseline ? 'bg-success-100 border-success-200 text-success-700' : 'bg-danger-50 border-danger-200 text-danger-700'
                        }`}>
                        {dim.has_jn_baseline ? '✓' : '✗'} {dim.dimension_label}
                        {dim.has_jn_baseline && dim.jn_score != null && (
                          <span style={{ marginLeft: 4, fontWeight: 700 }}>{dim.jn_score.toFixed(1)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <p style={{ margin: '8px 0 0', fontSize: 10.5, color: '#A1A1AA' }}>
                ✓ = standard JN ada baseline dari Fasa A · ✗ = tiada baseline — DI tak bermakna
              </p>
            </Card>
          )}

          {error && <div className="bg-danger-100 text-danger-800 rounded-md px-3.5 py-2.5 text-sm">{error}</div>}

          <button
            disabled={pulling || !selSource || selSchools.length === 0}
            onClick={handlePull}
            className="btn-primary !px-6 !py-3 !text-sm w-full sm:w-auto">
            {pulling ? '⏳ Sedang memproses…' :
              selSource?.sourceType === 'api' ? '🟠 Tarik Data dari API' : '🟠 Muat Naik & Proses Dokumen'}
          </button>

          {result && result.runCategory === 'outsource' && (
            <Card className="border-warning-200 bg-warning-50">
              <div style={{ fontWeight: 700, color: '#854D0E', marginBottom: 8 }}>
                ✅ {result.records} rekod berjaya diekstrak!
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#3F3F46' }}>
                Rekod disimpan dalam status <strong>Menunggu Semakan</strong>.
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#A16207' }}>
                Pergi ke tab <strong>🔍 Semakan Rekod</strong> untuk luluskan rekod dan jana kes.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// TAB 3 — Semakan Rekod (outsource only)
// ══════════════════════════════════════════════════════════════════════════
// Routine (no real anomaly) classifications get a pre-filled suggested note the
// officer can accept as-is or edit — real discrepancies still require free text.
const ROUTINE_DI_CLASSIFICATIONS = ['DATA_ALIGNED', 'MINOR_DISCREPANCY']

function suggestedIncidentText(rec) {
  if (!ROUTINE_DI_CLASSIFICATIONS.includes(rec.diClassification)) return ''
  return `Tiada anomali dikesan bagi ${rec.school?.schoolName || rec.schoolCodeRaw}; Discrepancy Index (${rec.discrepancyIndex?.toFixed(3) ?? '—'}) dalam julat diterima. Rekod disahkan untuk pemantauan rutin.`
}

function RecordsTab({ highlight }) {
  const [records, setRecords]     = useState([])
  const [total, setTotal]         = useState(0)
  const [filter, setFilter]       = useState('pending')
  const [loading, setLoading]     = useState(true)
  const [approving, setApproving] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [incidentText, setIncidentText] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [actionMsg, setActionMsg] = useState('')
  const [createdCaseId, setCreatedCaseId] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    getIngestionRecords({ status: filter || undefined, limit: 30 })
      .then(r => { setRecords(r.data.records); setTotal(r.data.total) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (highlight) load() }, [highlight])

  const doApprove = async (id) => {
    if (!incidentText || incidentText.length < 20)
      return setActionMsg('Sila masukkan teks insiden (min 20 aksara) sebelum meluluskan.')
    setActionMsg('')
    try {
      const r = await approveIngestionRecord(id, { incidentText })
      setCreatedCaseId(r.data.case?.id)
      setActionMsg(`✅ Kes ${r.data.case?.caseId} berjaya dicipta!`)
      setApproving(null); setIncidentText('')
      load()
    } catch (e) {
      setActionMsg(e.response?.data?.error || 'Gagal meluluskan rekod.')
    }
  }

  const doReject = async (id) => {
    try {
      await rejectIngestionRecord(id, { reason: rejectReason })
      setActionMsg('Rekod telah ditolak.')
      setRejecting(null); setRejectReason('')
      load()
    } catch {
      setActionMsg('Gagal menolak rekod.')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['pending', 'approved', 'rejected', 'case_created', ''].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3.5 py-1.5 rounded-full text-sm ${
              filter === s ? 'border-2 border-primary-600 bg-primary-50 font-bold' : 'border border-gray-200 bg-white font-normal'
            }`}>
            {s === '' ? 'Semua' : statusBadge(s).label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#A1A1AA', alignSelf: 'center' }}>{total} rekod</span>
      </div>

      {actionMsg && (
        <div className={`mb-3 px-3.5 py-2.5 rounded-md text-sm flex items-center gap-2 ${
          actionMsg.startsWith('✅') ? 'bg-success-50 text-success-800' : 'bg-danger-100 text-danger-800'
        }`}>
          <span style={{ flex: 1 }}>{actionMsg}</span>
          {createdCaseId && (
            <a href={`/cases/${createdCaseId}`}
              className="text-primary-600 font-semibold text-xs bg-primary-100 px-2.5 py-1 rounded-md no-underline flex-shrink-0">
              Lihat Kes →
            </a>
          )}
        </div>
      )}

      {loading ? <PageLoader />
        : records.length === 0 ? <p className="text-gray-500 text-center p-12">Tiada rekod ditemui.</p>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {records.map(rec => {
              const di = diBadge(rec.diClassification)
              const st = statusBadge(rec.status)
              return (
                <Card key={rec.id} style={{ borderLeft: `4px solid ${TONE_HEX[di.tone]}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700 }}>{rec.school?.schoolName || rec.schoolCodeRaw}</span>
                        <code className="text-xs bg-gray-100 rounded-sm px-1.5 py-0.5">{rec.schoolCodeRaw}</code>
                        {rec.school?.state && (
                          <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{rec.school.state}</span>
                        )}
                        <Badge {...di} />
                        <Badge {...st} />
                      </div>
                      <div style={{ display: 'flex', gap: 20, fontSize: 12, color: '#6B6B74', flexWrap: 'wrap' }}>
                        <span>Sumber: <strong>{rec.source?.sourceCode}</strong></span>
                        <span>Skor JN: <strong>{rec.jnAuditScore?.toFixed(1) ?? '—'}</strong></span>
                        <span>Skor Ops: <strong>{rec.compositeOperationalScore?.toFixed(1) ?? '—'}</strong></span>
                        <span>DI: <strong>{rec.discrepancyIndex != null ? rec.discrepancyIndex?.toFixed(3) : '—'}</strong></span>
                        <span>Tarikh: <strong>{rec.pullDate}</strong></span>
                      </div>
                      {Object.keys(rec.domainDi || {}).length > 0 && (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#6B6B74', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                            DI per Standard SKPM
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {Object.entries(rec.domainDi).map(([dom, d]) => {
                              const b = diBadge(d.classification)
                              return (
                                <div key={dom} title={`JN ${d.jn_score?.toFixed(1)} vs Ops ${d.operational_score?.toFixed(1)}`}
                                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md ${TONE_CLASSES[b.tone] || TONE_CLASSES.gray}`}>
                                  <span className="text-[11.5px] font-semibold">
                                    {DOMAIN_LABELS[dom] || dom.replace(/_/g, ' ')}
                                  </span>
                                  <span className="text-[11.5px]">
                                    {d.jn_score?.toFixed(1)} → {d.operational_score?.toFixed(1)}
                                  </span>
                                  <strong className="text-xs">DI {d.di?.toFixed(3)}</strong>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                      {rec.linkedCaseId && (
                        <div style={{ marginTop: 6, fontSize: 12, color: '#2563EB' }}>
                          → Kes berkaitan: <a href={`/cases/${rec.linkedCaseId}`} style={{ color: '#2563EB' }}>Lihat Kes</a>
                        </div>
                      )}
                    </div>

                    {rec.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button onClick={() => { setApproving(rec); setRejecting(null); setActionMsg(''); setIncidentText(suggestedIncidentText(rec)) }}
                          className="btn-primary !text-xs !px-3.5 !py-1.5">
                          Lulus & Cipta Kes
                        </button>
                        <button onClick={() => { setRejecting(rec); setApproving(null); setActionMsg('') }}
                          className="btn-danger !bg-danger-100 !text-danger-800 !border !border-danger-300 !shadow-none hover:!bg-danger-200 !text-xs !px-3.5 !py-1.5">
                          Tolak
                        </button>
                      </div>
                    )}
                  </div>

                  {approving?.id === rec.id && (
                    <Modal onClose={() => setApproving(null)}>
                      <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 15, color: '#1E3A8A' }}>
                        Luluskan Rekod → Cipta Kes Baharu
                      </p>
                      <p style={{ margin: '0 0 14px', fontSize: 13, color: '#6B6B74' }}>
                        {rec.school?.schoolName || rec.schoolCodeRaw}
                      </p>
                      {ROUTINE_DI_CLASSIFICATIONS.includes(rec.diClassification) && (
                        <p className="text-xs text-primary-700 bg-primary-50 px-3 py-2 rounded-md mb-2.5">
                          💡 Cadangan draf disediakan kerana rekod ini tiada anomali — sunting jika perlu.
                        </p>
                      )}
                      <textarea rows={4} placeholder="Huraikan insiden atau konteks discrepancy (min 20 aksara)…"
                        value={incidentText} onChange={e => setIncidentText(e.target.value)}
                        className="input resize-y" />
                      <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
                        <button onClick={() => setApproving(null)} className="btn-secondary">
                          Batal
                        </button>
                        <button onClick={() => doApprove(rec.id)} disabled={incidentText.length < 20} className="btn-primary">
                          ✅ Sahkan & Jalankan AI Pipeline
                        </button>
                      </div>
                    </Modal>
                  )}

                </Card>
              )
            })}
          </div>
        )}

      {rejecting && (
        <Modal onClose={() => setRejecting(null)}>
          <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 15, color: '#991B1B' }}>Tolak Rekod</p>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: '#6B6B74' }}>
            {rejecting.school?.schoolName || rejecting.schoolCodeRaw}
          </p>
          <input placeholder="Sebab penolakan (pilihan)…" value={rejectReason} onChange={e => setRejectReason(e.target.value)}
            className="input" />
          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
            <button onClick={() => setRejecting(null)} className="btn-secondary">
              Batal
            </button>
            <button onClick={() => doReject(rejecting.id)} className="btn-danger">
              Tolak Rekod
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// TAB 4 — Sejarah Run
// ══════════════════════════════════════════════════════════════════════════
function RunsTab() {
  const [runs, setRuns]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getIngestionRuns().then(r => setRuns(r.data.runs)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const runStatus = (s) => ({
    running:   { tone: 'primary', label: 'Berjalan' },
    completed: { tone: 'success', label: 'Selesai' },
    partial:   { tone: 'warning', label: 'Separa' },
    failed:    { tone: 'danger',  label: 'Gagal' },
  }[s] || { tone: 'gray', label: s })

  const categoryLabel = (c) => c === 'jn_baseline'
    ? <span style={{ color: '#1D4ED8', fontWeight: 600 }}>🔵 JN Baseline</span>
    : <span style={{ color: '#854D0E', fontWeight: 600 }}>🟠 Data Luar</span>

  return (
    <div>
      {loading ? <PageLoader /> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Run ID','Kategori','Sumber','Jenis','Rekod/Sekolah','Status','Dimulakan','Dicetuskan Oleh'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-700">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map(r => {
                const st = runStatus(r.status)
                return (
                  <tr key={r.id} className="border-b border-gray-100">
                    <td className="px-3 py-2.5"><code className="text-[11px] bg-gray-100 rounded-sm px-1">{r.id.slice(0, 8)}</code></td>
                    <td className="px-3 py-2.5">{categoryLabel(r.runCategory)}</td>
                    <td className="px-3 py-2.5">{r.source?.sourceCode || '—'}</td>
                    <td className="px-3 py-2.5">{r.runType}</td>
                    <td className="px-3 py-2.5 font-semibold">{r.recordsCreated}</td>
                    <td className="px-3 py-2.5"><Badge {...st} /></td>
                    <td className="px-3 py-2.5 text-gray-500">{new Date(r.startedAt).toLocaleString('ms-MY')}</td>
                    <td className="px-3 py-2.5">{r.triggeredBy?.name || 'Sistem'}</td>
                  </tr>
                )
              })}
              {runs.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-gray-400">Tiada rekod run.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════
const STEP_COLORS = { jn: '#2563EB', luar: '#CA8A04', records: '#2563EB' }

const STEPS = [
  { key: 'jn',      emoji: '🔵', label: 'Fasa A — JN Baseline',   sub: 'SK@S / SKPK / GDrive',       color: '#2563EB', activeBg: '#EFF6FF' },
  { key: 'luar',    emoji: '🟠', label: 'Fasa B — Data Luar',      sub: 'EMIS / APDM / Laporan',      color: '#CA8A04', activeBg: '#FEFCE8' },
  { key: 'records', emoji: '🔍', label: 'Semak & Lulus Rekod',     sub: 'DI comparison review',       color: '#2563EB', activeBg: '#EFF6FF' },
  { key: 'runs',    emoji: '📋', label: 'Sejarah Run',             sub: 'Log semua ingestion',         color: '#6B6B74', activeBg: '#FAFAFA' },
]

export default function DataIngestionPage() {
  const [tab, setTab]                 = useState('jn')
  const [recordsHighlight, setRecordsHighlight] = useState(0)
  const [completedSteps, setCompletedSteps]     = useState(new Set())

  // Shared state: schools loaded once, selSchools carry over Fasa A → Fasa B
  const [schools, setSchools]         = useState([])
  const [selSchools, setSelSchools]   = useState([])

  useEffect(() => {
    getSchools({ limit: 500 }).then(r => setSchools(r.data.schools || [])).catch(() => {})
  }, [])

  const markDone = (key) => setCompletedSteps(prev => new Set([...prev, key]))

  // After Fasa A success → mark jn done → auto-switch to Fasa B
  const handleFasaADone = () => {
    markDone('jn')
    setTab('luar')
  }

  // After Fasa B success → mark luar done → switch to Semakan Rekod
  const goToRecords = () => {
    markDone('luar')
    setRecordsHighlight(n => n + 1)
    setTab('records')
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#18181B' }}>
          🗄️ Pengurusan Ingestion Data
        </h1>
        <p style={{ margin: '4px 0 0', color: '#6B6B74', fontSize: 14 }}>
          <strong>Fasa A</strong>: Kemaskini skor audit JN →{' '}
          <strong>Fasa B</strong>: Tarik data luar → kira DI → semak → jana kes.
          {(tab === 'jn' || tab === 'luar') && selSchools.length > 0 && (
            <span style={{ marginLeft: 10, background: '#EFF6FF', color: '#2563EB', padding: '1px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 600 }}>
              {selSchools.length} sekolah dipilih
            </span>
          )}
        </p>
      </div>

      {/* Unified step navigator — replaces both old stepper + tab bar */}
      <div style={{
        display: 'flex', marginBottom: 24,
        background: '#FAFAFA', borderRadius: 10,
        border: '1px solid #E4E4E7', overflow: 'hidden',
      }}>
        {STEPS.map((step, i) => {
          const isActive = step.key === tab
          const isDone   = completedSteps.has(step.key)

          let bg = 'transparent'
          if (isActive) bg = step.activeBg
          else if (isDone) bg = '#F0FDF4'

          let borderColor = 'transparent'
          if (isActive) borderColor = step.color
          else if (isDone) borderColor = '#22C55E'

          let labelColor = '#A1A1AA'
          if (isActive) labelColor = '#18181B'
          else if (isDone) labelColor = '#15803D'

          return (
            <button
              key={step.key}
              onClick={() => setTab(step.key)}
              style={{
                flex: 1, padding: '13px 16px', border: 'none', textAlign: 'left',
                cursor: 'pointer', background: bg,
                borderBottom: `3px solid ${borderColor}`,
                borderRight: i < STEPS.length - 1 ? '1px solid #E4E4E7' : 'none',
                transition: 'background 0.15s',
              }}
            >
              {/* Step number badge + emoji */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{
                  width: 22, height: 22, borderRadius: '50%', display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800,
                  flexShrink: 0,
                  background: isDone ? '#22C55E' : isActive ? step.color : '#E4E4E7',
                  color: isDone || isActive ? '#fff' : '#A1A1AA',
                }}>
                  {isDone ? '✓' : i + 1}
                </span>
                <div style={{ fontSize: 13, fontWeight: 700, color: labelColor }}>
                  {step.label}
                </div>
              </div>
              <div style={{ fontSize: 11, color: isDone ? '#4ADE80' : '#A1A1AA', paddingLeft: 30 }}>
                {step.sub}
              </div>
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'jn' && (
        <JNBaselineTab
          schools={schools}
          selSchools={selSchools}
          setSelSchools={setSelSchools}
          onDone={handleFasaADone}
        />
      )}
      {tab === 'luar' && (
        <OutsourceTab
          schools={schools}
          selSchools={selSchools}
          setSelSchools={setSelSchools}
          onRecordsCreated={goToRecords}
        />
      )}
      {tab === 'records' && <RecordsTab highlight={recordsHighlight} />}
      {tab === 'runs'    && <RunsTab />}
    </div>
  )
}
