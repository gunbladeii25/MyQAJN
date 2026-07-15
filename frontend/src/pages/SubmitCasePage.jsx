import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, PenLine, Search,
  CheckSquare, Square, Loader2, CheckCircle, AlertTriangle, Info,
} from 'lucide-react'
import { getSchools, submitCase } from '../services/api'

const STATES = [
  'Johor','Kedah','Kelantan','Melaka','Negeri Sembilan',
  'Pahang','Perak','Perlis','Pulau Pinang','Sabah',
  'Sarawak','Selangor','Terengganu','Kuala Lumpur','Labuan','Putrajaya'
]
// 19 nilai sebenar JENISSEKOLAH daripada senarai_sekolah.csv (backend/data) —
// termasuk "SM  Agama (SABK)" dengan ruang berganda, itu sememangnya nilai
// sebenar dalam data sumber, bukan salah taip di sini. Guna sama persis
// supaya filter server-side (padanan tepat pada School.schoolType) berfungsi.
const SCHOOL_TYPES = [
  'Kolej Tingkatan 6', 'Kolej Vokasional', 'SJK(C)', 'SJK(T)', 'SK',
  'SK (Pendidikan Khas)', 'SM  Agama (SABK)', 'SM (Pendidikan Khas)',
  'SM + SR (Model Khas)', 'SM Berasrama Penuh', 'SM Teknik', 'SMK',
  'SMK Agama', 'SR Agama (SABK)', 'SR Model Khas Komprehensif K9',
  'Sekolah Bimbingan Jalinan Kasih', 'Sekolah Model Khas Komprehensif 11',
  'Sekolah Seni', 'Sekolah Sukan',
]

const diClass = (di) => {
  if (di === null || di === undefined) return null
  if (di >= 0.75) return { label: 'EXTREME', color: 'text-danger-700 bg-danger-100' }
  if (di >= 0.50) return { label: 'SEVERE',  color: 'text-warning-700 bg-warning-100' }
  if (di >= 0.25) return { label: 'MODERATE',color: 'text-warning-700 bg-warning-50' }
  if (di >= 0.10) return { label: 'MINOR',   color: 'text-primary-700 bg-primary-100' }
  return { label: 'ALIGNED', color: 'text-success-700 bg-success-100' }
}

export default function SubmitCasePage() {
  const navigate = useNavigate()

  const [step, setStep] = useState(1)

  // Schools — server-side search (backend/src/controllers/schools.controller.js
  // already supports state/schoolType/district/search/limit). With the real
  // ~10,251-school directory imported, a one-shot "load 500, filter
  // client-side" approach would silently hide everything past the first
  // 500 by schoolCode — so this page reflects live search results, not a
  // static prefetched list.
  const [results, setResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(true)
  const [filterNegeri, setFilterNegeri] = useState('')
  const [filterDaerah, setFilterDaerah] = useState('')
  const [filterJenis, setFilterJenis]   = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [daerahList, setDaerahList] = useState([])

  // id -> full school object, so a selected school survives even after the
  // search results move on (selection is no longer a Set over one static
  // fetched array — the array itself changes as you search/filter).
  const [selectedMap, setSelectedMap] = useState({})
  const selectedIds = new Set(Object.keys(selectedMap))
  const selectedSchools = Object.values(selectedMap)

  // Manual scores: { [schoolId]: operationalScore }
  const [scores, setScores] = useState({})

  // Shared incident text
  const [incidentText, setIncidentText] = useState('')

  // Batch submit results
  const [submitResults, setSubmitResults] = useState([])
  const [submitting, setSubmitting] = useState(false)

  // Debounced server-side search — refires on any filter/search change.
  useEffect(() => {
    setSearchLoading(true)
    const handle = setTimeout(() => {
      getSchools({
        state: filterNegeri || undefined,
        district: filterDaerah || undefined,
        schoolType: filterJenis || undefined,
        search: searchQ || undefined,
        limit: 50,
      }).then((r) => setResults(r.data.schools || [])).finally(() => setSearchLoading(false))
    }, 300)
    return () => clearTimeout(handle)
  }, [filterNegeri, filterDaerah, filterJenis, searchQ])

  // District options — fetched fresh per selected state (one state safely
  // has well under 500 schools) rather than derived from a capped
  // nationwide fetch, which would miss most districts once real data is in.
  useEffect(() => {
    if (!filterNegeri) { setDaerahList([]); return }
    getSchools({ state: filterNegeri, limit: 500 }).then((r) =>
      setDaerahList([...new Set((r.data.schools || []).map((s) => s.district).filter(Boolean))].sort())
    )
  }, [filterNegeri])

  const toggleSchool = (school) => {
    setSelectedMap((prev) => {
      const next = { ...prev }
      if (next[school.id]) delete next[school.id]
      else next[school.id] = school
      return next
    })
  }
  const toggleAll = () => {
    const allSelected = results.length > 0 && results.every((s) => selectedMap[s.id])
    setSelectedMap((prev) => {
      const next = { ...prev }
      results.forEach((s) => { allSelected ? delete next[s.id] : (next[s.id] = s) })
      return next
    })
  }

  const canProceed = selectedIds.size > 0 &&
    selectedSchools.every(s => scores[s.id] !== undefined && scores[s.id] !== '')

  const handleSubmitAll = async () => {
    if (!incidentText.trim() || incidentText.length < 20) return
    setSubmitting(true)
    setStep(3)
    const res = []
    for (const school of selectedSchools) {
      const opScore = parseFloat(scores[school.id])
      if (isNaN(opScore)) { res.push({ school, error: 'Skor tidak sah' }); continue }
      try {
        const r = await submitCase({
          schoolId: school.id,
          operationalScore: opScore,
          incidentText,
          sourceSystem: 'MANUAL',
        })
        res.push({ school, case: r.data.case })
      } catch (e) {
        res.push({ school, error: e.response?.data?.error || 'Ralat pipeline AI' })
      }
      setSubmitResults([...res])
    }
    setSubmitting(false)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => step > 1 && !submitting ? setStep(s => s - 1) : navigate('/cases')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Hantar Kes Manual</h1>
          <p className="text-sm text-gray-500">Input skor operasi secara manual oleh pegawai JN</p>
        </div>
        <div className="hidden sm:flex items-center gap-1 text-xs">
          {['Pilih Sekolah & Skor','Semak & Hantar','Keputusan'].map((label, i) => (
            <span key={i} className={`flex items-center gap-1 ${i < 2 ? 'after:content-["→"] after:mx-1 after:text-gray-300' : ''}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold
                ${step === i+1 ? 'bg-primary-600 text-white' : step > i+1 ? 'bg-success-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {step > i+1 ? '✓' : i+1}
              </span>
              <span className={step === i+1 ? 'font-semibold text-primary-700' : 'text-gray-400'}>{label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ═══ STEP 1 ══════════════════════════════════════════════════════════ */}
      {step === 1 && (
        <div className="space-y-5">
          {/* Redirect notice */}
          <div className="card p-4 flex items-start gap-3 bg-primary-50 border border-primary-200">
            <Info className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-primary-900">Halaman ini untuk Input Manual sahaja</p>
              <p className="text-xs text-primary-700 mt-0.5">
                Untuk tarik data dari API (EMIS, APDM, SK@S, SKPK) atau muat naik dokumen (JPN/PPD), sila guna halaman{' '}
                <button onClick={() => navigate('/ingestion')} className="font-bold underline">Ingestion Data</button>.
              </p>
            </div>
          </div>

          {/* Manual mode — source label fixed */}
          <div className="card p-5">
            <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-primary-600 bg-primary-50">
              <PenLine className="w-5 h-5 text-primary-600" />
              <div>
                <p className="text-sm font-semibold text-primary-700">Input Manual</p>
                <p className="text-xs text-gray-500">Pegawai JN masukkan skor operasi sekolah secara terus</p>
              </div>
            </div>
          </div>

          {/* School filter + multi-select */}
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Pilih Sekolah dan Masukkan Skor Operasi</h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <select className="input text-xs py-1.5" value={filterNegeri} onChange={e => { setFilterNegeri(e.target.value); setFilterDaerah('') }}>
                <option value="">Semua Negeri</option>
                {STATES.map(s => <option key={s}>{s}</option>)}
              </select>
              <select className="input text-xs py-1.5" value={filterDaerah} onChange={e => setFilterDaerah(e.target.value)} disabled={!filterNegeri}>
                <option value="">Semua Daerah</option>
                {daerahList.map(d => <option key={d}>{d}</option>)}
              </select>
              <select className="input text-xs py-1.5" value={filterJenis} onChange={e => setFilterJenis(e.target.value)}>
                <option value="">Semua Jenis</option>
                {SCHOOL_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input className="input text-xs py-1.5 pl-7" placeholder="Cari sekolah..."
                  value={searchQ} onChange={e => setSearchQ(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500">
              <button onClick={toggleAll} className="flex items-center gap-1.5 hover:text-primary-700 font-medium">
                {results.length > 0 && results.every(s => selectedIds.has(s.id))
                  ? <CheckSquare className="w-4 h-4 text-primary-600" />
                  : <Square className="w-4 h-4" />}
                Pilih semua ({results.length} dipaparkan)
              </button>
              {selectedIds.size > 0 && (
                <span className="bg-primary-600 text-white px-2 py-0.5 rounded-full font-semibold">{selectedIds.size} dipilih</span>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
              {searchLoading
                ? <p className="text-center text-sm text-gray-400 py-8 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Mencari sekolah...
                  </p>
                : results.length === 0
                ? <p className="text-center text-sm text-gray-400 py-8">Tiada sekolah dijumpai</p>
                : results.map(s => {
                  const opScore = scores[s.id]
                  const di = opScore !== undefined && s.jnAuditScore !== null
                    ? Math.abs(s.jnAuditScore - parseFloat(opScore)) / 100 : null
                  const cls = diClass(di)
                  return (
                    <div key={s.id} onClick={() => toggleSchool(s)}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors
                        ${selectedIds.has(s.id) ? 'bg-primary-50' : ''}`}>
                      {selectedIds.has(s.id)
                        ? <CheckSquare className="w-4 h-4 text-primary-600 flex-shrink-0" />
                        : <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.schoolName}</p>
                        <p className="text-xs text-gray-500">{s.schoolCode} · {s.district}, {s.state}</p>
                      </div>
                      <div className="text-right flex-shrink-0 space-y-0.5">
                        <p className="text-xs text-gray-400">Skor JN: <span className="font-semibold text-gray-700">{s.jnAuditScore ?? '—'}</span></p>
                        {cls && di !== null && <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${cls.color}`}>{cls.label} ({di.toFixed(3)})</span>}
                      </div>
                      {/* Manual score input — only when selected */}
                      {selectedIds.has(s.id) && (
                        <input type="number" min="0" max="100" step="0.1"
                          className="input w-24 text-xs py-1 ml-2 text-right"
                          placeholder="Skor ops"
                          value={scores[s.id] ?? ''}
                          onClick={e => e.stopPropagation()}
                          onChange={e => setScores(prev => ({ ...prev, [s.id]: e.target.value }))}
                        />
                      )}
                    </div>
                  )
                })
              }
            </div>
          </div>

          <div className="flex justify-end">
            <button disabled={!canProceed} onClick={() => setStep(2)}
              className="btn-primary flex items-center gap-2 disabled:opacity-40">
              Seterusnya: Semak & Hantar <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 2: REVIEW ══════════════════════════════════════════════════ */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Semakan Data — {selectedSchools.length} Sekolah · Sumber: MANUAL
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-200">
                    <th className="text-left py-2 pr-4 font-medium">Bil.</th>
                    <th className="text-left py-2 pr-4 font-medium">Sekolah</th>
                    <th className="text-right py-2 px-3 font-medium">Skor JN</th>
                    <th className="text-right py-2 px-3 font-medium">Skor Ops</th>
                    <th className="text-right py-2 px-3 font-medium">DI (Anggaran)</th>
                    <th className="text-right py-2 pl-3 font-medium">Edit Skor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedSchools.map((s, i) => {
                    const op = parseFloat(scores[s.id])
                    const di = !isNaN(op) && s.jnAuditScore != null ? Math.abs(s.jnAuditScore - op) / 100 : null
                    const cls = diClass(di)
                    return (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="py-2 pr-2 text-gray-400 tabular-nums">{i + 1}</td>
                        <td className="py-2 pr-4">
                          <p className="font-medium text-gray-900">{s.schoolName}</p>
                          <p className="text-gray-400">{s.schoolCode} · {s.district}</p>
                        </td>
                        <td className="text-right px-3 font-mono font-semibold text-gray-700">{s.jnAuditScore ?? '—'}</td>
                        <td className="text-right px-3 font-mono font-semibold text-primary-700">{isNaN(op) ? '—' : op.toFixed(1)}</td>
                        <td className="text-right px-3">
                          {cls
                            ? <span className={`font-bold px-1.5 py-0.5 rounded ${cls.color}`}>{cls.label}<br/><span className="font-mono">{di.toFixed(3)}</span></span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="text-right pl-3">
                          <input type="number" min="0" max="100" step="0.1"
                            className="input w-20 text-xs py-1 text-right"
                            value={scores[s.id] ?? ''}
                            onChange={e => setScores(prev => ({ ...prev, [s.id]: e.target.value }))}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-5">
            <label className="label">Teks Laporan / Pemerhatian <span className="text-danger-600">*</span></label>
            <p className="text-xs text-gray-400 mb-2">Dikongsi untuk semua sekolah yang dipilih. Agent A akan menganalisis untuk klasifikasi dan severity.</p>
            <textarea rows={5} className="input resize-none"
              placeholder="Huraikan pemerhatian atau isu yang dikesan..."
              value={incidentText}
              onChange={e => setIncidentText(e.target.value)}
            />
            {incidentText.length > 0 && incidentText.length < 20 && (
              <p className="text-danger-600 text-xs mt-1">Minimum 20 aksara diperlukan</p>
            )}
          </div>

          <div className="flex gap-3 justify-end">
            <button onClick={() => setStep(1)} className="btn-secondary">Kembali</button>
            <button
              disabled={incidentText.length < 20 || selectedSchools.some(s => isNaN(parseFloat(scores[s.id])))}
              onClick={handleSubmitAll}
              className="btn-primary flex items-center gap-2 disabled:opacity-40">
              <CheckCircle className="w-4 h-4" />
              Hantar {selectedSchools.length} Kes & Jalankan Pipeline AI
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 3: RESULTS ═════════════════════════════════════════════════ */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin text-primary-600" /> Pipeline AI sedang memproses...</>
                : <><CheckCircle className="w-4 h-4 text-success-600" /> Pemprosesan Selesai</>}
            </h3>
            <div className="space-y-2">
              {selectedSchools.map((school) => {
                const r = submitResults.find(x => x.school.id === school.id)
                return (
                  <div key={school.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border
                      ${r?.case ? 'bg-success-50 border-success-200' : r?.error ? 'bg-danger-50 border-danger-200' : 'bg-gray-50 border-gray-200'}`}>
                    {r?.case
                      ? <CheckCircle className="w-4 h-4 text-success-600 flex-shrink-0" />
                      : r?.error
                      ? <AlertTriangle className="w-4 h-4 text-danger-500 flex-shrink-0" />
                      : <Loader2 className="w-4 h-4 text-gray-400 animate-spin flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{school.schoolName}</p>
                      {r?.case && (
                        <p className="text-xs text-success-700">
                          ID: <span className="font-mono">{r.case.caseId}</span>
                          {' · '}DI: <span className="font-mono">{Number(r.case.discrepancyIndex).toFixed(4)}</span>
                          {' · '}{r.case.alertLevel}
                        </p>
                      )}
                      {r?.error && <p className="text-xs text-danger-600">{r.error}</p>}
                      {!r && <p className="text-xs text-gray-400">Menunggu...</p>}
                    </div>
                    {r?.case && (
                      <button onClick={() => navigate(`/cases/${r.case.id}`)}
                        className="text-xs text-primary-700 font-medium hover:underline flex-shrink-0">
                        Lihat →
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {!submitting && (
            <div className="flex gap-3 justify-end">
              <button onClick={() => navigate('/cases')} className="btn-secondary">Senarai Kes</button>
              <button onClick={() => { setStep(1); setSubmitResults([]); setSelectedMap({}); setScores({}); setIncidentText('') }}
                className="btn-primary">Hantar Kes Manual Baharu</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
