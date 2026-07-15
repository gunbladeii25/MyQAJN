import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Filter, MessageSquare, X } from 'lucide-react'
import { getCases, getDashboard } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import { AlertBadge, DiClassBadge, StatusBadge } from '../components/ui/AlertBadge'
import { CASE_STATUS } from '../constants'
import { PageLoader } from '../components/ui/Spinner'

export default function CasesPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [cases, setCases] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ status: '', alertLevel: '', page: 1 })
  const [jpnPending, setJpnPending] = useState(0)
  const [stripDismissed, setStripDismissed] = useState(false)

  const canSubmit = ['admin', 'peneraju_sektor'].includes(user?.role)
  const isPenyelarasJpn = user?.role === 'penyelaras_jpn'

  // Berapa banyak eskalasi (bukan sekadar kes) masih tertunggak respons rasmi
  // negeri — kolum "Status" jadual di bawah ialah status KES, bukan status
  // respons eskalasi, jadi Penyelaras JPN tidak nampak ini pada pandangan
  // pertama tanpa membuka setiap kes satu-satu.
  useEffect(() => {
    if (!isPenyelarasJpn) return
    getDashboard().then((r) => setJpnPending(r.data.escalationsPending ?? 0)).catch(() => {})
  }, [isPenyelarasJpn])

  const load = async () => {
    setLoading(true)
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''))
      const res = await getCases(params)
      setCases(res.data.cases)
      setTotal(res.data.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filters])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{isPenyelarasJpn ? 'Kes Dieskalasi Kepada Negeri Anda' : 'Pengurusan Kes'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isPenyelarasJpn
              ? `${total} kes dieskalasi — buka kes untuk beri respons rasmi negeri terhadap syor`
              : `${total} kes dijumpai`}
          </p>
        </div>
        {canSubmit && (
          <button onClick={() => navigate('/cases/new')} className="btn-primary">
            <Plus className="w-4 h-4" /> Submit Kes (Manual)
          </button>
        )}
      </div>

      {isPenyelarasJpn && jpnPending > 0 && !stripDismissed && (
        <div className="flex items-center justify-between gap-4 bg-primary-50 border border-primary-100 rounded-md px-4 py-3 text-sm">
          <div className="flex items-center gap-2.5 text-primary-800">
            <MessageSquare className="w-[18px] h-[18px] flex-shrink-0" />
            <span>{jpnPending} kes eskalasi masih menunggu respons rasmi negeri anda.</span>
          </div>
          <button onClick={() => setStripDismissed(true)} className="flex-shrink-0 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <select className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}>
            <option value="">Semua Status</option>
            {Object.entries(CASE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <select className="input" value={filters.alertLevel} onChange={(e) => setFilters({ ...filters, alertLevel: e.target.value, page: 1 })}>
            <option value="">Semua Tahap Amaran</option>
            {['RED', 'ORANGE', 'YELLOW', 'BLUE', 'GREEN'].map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? <PageLoader /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Bil.</th>
                  {['ID Kes', 'Sekolah', 'Negeri', 'DI', 'Amaran', 'Kategori', 'Status', 'Tarikh'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cases.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400 text-sm">
                    {isPenyelarasJpn ? 'Tiada kes dieskalasi ke negeri anda buat masa ini.' : 'Tiada kes ditemui.'}
                  </td></tr>
                )}
                {cases.map((c, i) => (
                  <tr key={c.id} onClick={() => navigate(`/cases/${c.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500 tabular-nums">{i + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs font-medium text-primary-600">{c.caseId}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 truncate max-w-[180px]">{c.school?.schoolName}</p>
                      <p className="text-gray-400 text-xs">{c.school?.schoolCode}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{c.school?.state || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{Number(c.discrepancyIndex).toFixed(4)}</td>
                    <td className="px-4 py-3"><AlertBadge level={c.alertLevel} /></td>
                    <td className="px-4 py-3 text-xs text-gray-600">{c.category?.replace('_', ' ')}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} colorMap={CASE_STATUS} /></td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(c.createdAt).toLocaleDateString('ms-MY')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
