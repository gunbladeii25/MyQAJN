import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, Clock, FileText, Filter, Signature } from 'lucide-react'
import { getBriefs, signBrief, bulkSignBriefs } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import { AlertBadge } from '../components/ui/AlertBadge'
import { PageLoader } from '../components/ui/Spinner'
import Modal from '../components/ui/Modal'

const SIGN_FILTERS = [
  { value: '',          label: 'Semua Status' },
  { value: 'pending',   label: 'Menunggu Tandatangan' },
  { value: 'signed',    label: 'Lengkap Ditandatangani' },
]
const ALERT_LEVELS = ['RED', 'ORANGE', 'YELLOW', 'BLUE', 'GREEN']

export default function BriefsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [briefs, setBriefs] = useState([])
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(null)
  const [signModal, setSignModal] = useState(null)
  const [search, setSearch] = useState('')
  const [signFilter, setSignFilter] = useState('')
  const [alertFilter, setAlertFilter] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [bulkModal, setBulkModal] = useState(null) // signType being confirmed
  const [bulkSigning, setBulkSigning] = useState(false)
  const [bulkResult, setBulkResult] = useState(null)

  const isTopManagement = user?.role === 'top_management'

  const load = () => getBriefs().then((r) => setBriefs(r.data.briefs)).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const handleSign = async (caseId, signType) => {
    setSigning(caseId)
    try { await signBrief(caseId, signType); load() } finally { setSigning(null); setSignModal(null) }
  }

  const toggleSelect = (caseId) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(caseId) ? next.delete(caseId) : next.add(caseId)
      return next
    })
  }

  const toggleSelectAll = (rows) => {
    setSelected((prev) => {
      const selectableIds = rows.filter(b => !(b.signedByKetuaJn && b.signedByAuditDirector)).map(b => b.caseId)
      const allSelected = selectableIds.length > 0 && selectableIds.every(id => prev.has(id))
      return allSelected ? new Set() : new Set(selectableIds)
    })
  }

  const handleBulkSign = async (signType) => {
    setBulkSigning(true)
    try {
      const { data } = await bulkSignBriefs([...selected], signType)
      setBulkResult(data)
      setSelected(new Set())
      load()
    } finally {
      setBulkSigning(false)
      setBulkModal(null)
    }
  }

  // Summary counts — dikira daripada senarai penuh (bukan hasil tapisan)
  // supaya kad ringkasan sentiasa cerminkan gambaran keseluruhan.
  const summary = useMemo(() => {
    const total = briefs.length
    const signed = briefs.filter(b => b.signedByKetuaJn && b.signedByAuditDirector).length
    return { total, signed, pending: total - signed }
  }, [briefs])

  const filtered = useMemo(() => briefs.filter(b => {
    const bothSigned = b.signedByKetuaJn && b.signedByAuditDirector
    if (signFilter === 'pending' && bothSigned) return false
    if (signFilter === 'signed' && !bothSigned) return false
    if (alertFilter && b.case?.alertLevel !== alertFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const hay = `${b.case?.caseId || ''} ${b.case?.school?.schoolName || ''} ${b.case?.school?.schoolCode || ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  }), [briefs, signFilter, alertFilter, search])

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Executive Briefs</h1>
        <p className="text-sm text-gray-500 mt-0.5">{briefs.length} brief dijumpai</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Jumlah Brief" value={summary.total} color="blue" />
        <SummaryCard label="Menunggu Tandatangan" value={summary.pending} color="amber" />
        <SummaryCard label="Lengkap Ditandatangani" value={summary.signed} color="green" />
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px]">
          <input className="input" placeholder="Cari ID kes / nama / kod sekolah…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 min-w-[200px]">
          <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <select className="input" value={signFilter} onChange={(e) => setSignFilter(e.target.value)}>
            {SIGN_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div className="min-w-[160px]">
          <select className="input" value={alertFilter} onChange={(e) => setAlertFilter(e.target.value)}>
            <option value="">Semua Tahap Amaran</option>
            {ALERT_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* Bulk sign result banner */}
      {bulkResult && (
        <div className="bg-success-50 border border-success-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-success-800">
            ✅ {bulkResult.signed} brief berjaya ditandatangani pukal.
            {bulkResult.alreadySigned > 0 && ` ${bulkResult.alreadySigned} sudah ditandatangani sebelum ini (dilangkau).`}
          </p>
          <button onClick={() => setBulkResult(null)} className="text-xs text-success-600 hover:underline">Tutup</button>
        </div>
      )}

      {/* Bulk action bar — Pengurusan Atasan sahaja, muncul apabila ada pilihan */}
      {isTopManagement && selected.size > 0 && (
        <div className="card p-4 flex flex-wrap items-center justify-between gap-3 bg-primary-50 border-primary-200">
          <p className="text-sm font-medium text-gray-800">{selected.size} brief dipilih untuk tandatangan pukal</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setBulkModal('ketua_jn')} className="btn-primary text-xs py-1.5 flex items-center gap-1.5">
              <Signature className="w-3.5 h-3.5" /> Tandatangan Pukal — Ketua Nazir Sekolah
            </button>
            <button onClick={() => setBulkModal('audit_director')} className="btn-secondary text-xs py-1.5 flex items-center gap-1.5">
              <Signature className="w-3.5 h-3.5" /> Tandatangan Pukal — Nazir Pemeriksa
            </button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:underline">Batal Pilihan</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {isTopManagement && (
                  <th className="px-4 py-3 text-left w-8">
                    <input type="checkbox"
                      checked={filtered.some(b => !(b.signedByKetuaJn && b.signedByAuditDirector)) &&
                        filtered.filter(b => !(b.signedByKetuaJn && b.signedByAuditDirector)).every(b => selected.has(b.caseId))}
                      onChange={() => toggleSelectAll(filtered)} />
                  </th>
                )}
                {['ID Kes', 'Sekolah', 'Negeri', 'Amaran', 'Tarikh', 'Model', 'Ketua Nazir Sekolah', 'Nazir Pemeriksa', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr><td colSpan={isTopManagement ? 10 : 9} className="px-4 py-10 text-center text-gray-400 text-sm">
                  {briefs.length === 0 ? 'Tiada executive brief lagi.' : 'Tiada brief sepadan dengan tapisan.'}
                </td></tr>
              )}
              {filtered.map((b) => {
                const bothSigned = b.signedByKetuaJn && b.signedByAuditDirector
                return (
                  <tr key={b.id} onClick={() => navigate(`/cases/${b.case?.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors">
                    {isTopManagement && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {!bothSigned && (
                          <input type="checkbox" checked={selected.has(b.caseId)} onChange={() => toggleSelect(b.caseId)} />
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono text-xs font-medium text-primary-600">{b.case?.caseId}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 truncate max-w-[180px]">{b.case?.school?.schoolName}</p>
                      <p className="text-gray-400 text-xs">{b.case?.school?.schoolCode}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{b.case?.school?.state || '—'}</td>
                    <td className="px-4 py-3"><AlertBadge level={b.case?.alertLevel} /></td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(b.createdAt).toLocaleDateString('ms-MY')}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{b.llmModelUsed}</td>
                    <td className="px-4 py-3"><SignChip label="" signed={b.signedByKetuaJn} /></td>
                    <td className="px-4 py-3"><SignChip label="" signed={b.signedByAuditDirector} /></td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {user?.role === 'top_management' && !bothSigned ? (
                        <button onClick={() => setSignModal(b)} className="btn-primary text-xs py-1.5 whitespace-nowrap">
                          Tandatangan
                        </button>
                      ) : (
                        <button onClick={() => navigate(`/cases/${b.case?.id}`)} className="btn-secondary text-xs py-1.5 whitespace-nowrap">
                          <FileText className="w-3.5 h-3.5" /> Lihat Kes
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sign modal */}
      <Modal open={!!signModal} onClose={() => setSignModal(null)} title="Tandatangani Executive Brief">
        {signModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Brief untuk kes <span className="font-mono font-bold">{signModal.case?.caseId}</span> memerlukan tandatangan sebelum pengedaran rasmi.
            </p>
            <div className="bg-warning-50 border border-warning-200 rounded-lg p-3 text-xs text-warning-700">
              ⚠️ Tandatangan ini mengesahkan bahawa anda telah menyemak kandungan brief dan bersetuju dengan cadangan tindakan yang disenaraikan.
            </div>
            <div className="space-y-2">
              {!signModal.signedByKetuaJn && (
                <button onClick={() => handleSign(signModal.caseId, 'ketua_jn')} disabled={!!signing} className="btn-primary w-full">
                  {signing === signModal.caseId ? 'Memproses...' : 'Tandatangan sebagai Ketua Nazir Sekolah'}
                </button>
              )}
              {!signModal.signedByAuditDirector && (
                <button onClick={() => handleSign(signModal.caseId, 'audit_director')} disabled={!!signing} className="btn-secondary w-full">
                  {signing === signModal.caseId ? 'Memproses...' : 'Tandatangan sebagai Nazir Pemeriksa'}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk sign confirm modal */}
      <Modal open={!!bulkModal} onClose={() => setBulkModal(null)} title="Tandatangan Pukal">
        {bulkModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Anda akan menandatangani <span className="font-bold">{selected.size} brief</span> sekaligus sebagai{' '}
              <span className="font-bold">{bulkModal === 'ketua_jn' ? 'Ketua Nazir Sekolah' : 'Nazir Pemeriksa'}</span>.
            </p>
            <div className="bg-warning-50 border border-warning-200 rounded-lg p-3 text-xs text-warning-700">
              ⚠️ Tandatangan ini mengesahkan bahawa anda telah menyemak kandungan setiap brief yang dipilih dan bersetuju dengan cadangan tindakan yang disenaraikan. Brief yang sudah ditandatangani untuk peranan ini akan dilangkau secara automatik.
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setBulkModal(null)} className="btn-secondary">Batal</button>
              <button onClick={() => handleBulkSign(bulkModal)} disabled={bulkSigning} className="btn-primary">
                {bulkSigning ? 'Memproses...' : `Sahkan Tandatangan Pukal (${selected.size})`}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function SignChip({ label, signed }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border
      ${signed ? 'bg-success-100 text-success-700 border-success-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {signed ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
      {label}
    </span>
  )
}

function SummaryCard({ label, value, color }) {
  const colors = {
    blue:  'bg-primary-50 text-primary-600',
    amber: 'bg-warning-50 text-warning-600',
    green: 'bg-success-50 text-success-600',
  }
  return (
    <div className="card p-4">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className={`text-xs font-medium mt-0.5 inline-block px-2 py-0.5 rounded ${colors[color]}`}>{label}</p>
    </div>
  )
}
