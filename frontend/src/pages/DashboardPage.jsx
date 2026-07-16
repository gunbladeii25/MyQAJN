import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, FileText, Clock, TrendingUp, X, ExternalLink, MessageSquare, Database, BookOpen, Users } from 'lucide-react'
import { getDashboard, getCases, dashboardStreamUrl } from '../services/api'
import { useToast } from '../components/ui/Toast'
import { useAuthStore } from '../stores/authStore'
import { AlertBadge, DiClassBadge, StatusBadge } from '../components/ui/AlertBadge'
import { CASE_STATUS, ROLES } from '../constants'
import { PageLoader } from '../components/ui/Spinner'
import PageBanner from '../components/ui/PageBanner'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from 'recharts'

// MYDS-aligned tokens: danger-600, orange-600 (stock), amber-600 (warning), primary-600, success-600
const KPI_COLORS = ['#DC2626', '#EA580C', '#CA8A04', '#2563EB', '#16A34A']
const ALERT_ORDER = ['RED', 'ORANGE', 'YELLOW', 'BLUE', 'GREEN']
const ALERT_LABELS = {
  RED:    'Ekstrem',
  ORANGE: 'Teruk',
  YELLOW: 'Sederhana',
  BLUE:   'Minor',
  GREEN:  'Selaras',
}
const ALERT_SUBLABELS = {
  RED:    'DI ≥ 0.75',
  ORANGE: 'DI 0.50–0.74',
  YELLOW: 'DI 0.25–0.49',
  BLUE:   'DI 0.10–0.24',
  GREEN:  'DI < 0.10',
}

// ── Gradient bar custom shape ─────────────────────────────────────────────────
const RoundedBar = (props) => {
  const { x, y, width, height, fill } = props
  if (!height || height <= 0) return null
  const r = Math.min(6, width / 2)
  return (
    <g>
      <defs>
        <linearGradient id={`grad-${fill?.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} stopOpacity={0.95} />
          <stop offset="100%" stopColor={fill} stopOpacity={0.55} />
        </linearGradient>
      </defs>
      <rect x={x} y={y} width={width} height={height}
        fill={`url(#grad-${fill?.slice(1)})`} rx={r} ry={r} />
    </g>
  )
}

// ── Custom bar tooltip ────────────────────────────────────────────────────────
const BarTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const { name, value, fill } = payload[0].payload
  return (
    <div style={{
      background: '#18181B', color: '#FAFAFA', padding: '8px 14px',
      borderRadius: 8, fontSize: 13, fontWeight: 600,
      boxShadow: '0 2px 6px 0 rgba(24,24,27,.05), 0 12px 50px 0 rgba(24,24,27,.10)',
    }}>
      <span style={{ color: fill, marginRight: 8 }}>●</span>
      {ALERT_LABELS[name] || name} ({ALERT_SUBLABELS[name]}): {value} kes
    </div>
  )
}

// ── Custom pie label ──────────────────────────────────────────────────────────
const PieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
  if (value === 0) return null
  const RADIAN = Math.PI / 180
  const r = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
      fontSize={12} fontWeight={700}>{value}</text>
  )
}

const STATUS_COLORS = ['#2563EB', '#16A34A', '#EA580C', '#6B6B74'] // primary-600, success-600, orange-600, gray-500

// entry.color daripada Recharts merujuk fill Cell (`url(#pieGrad0)` — rujukan
// gradient SVG), yang tidak sah sebagai CSS `background` di luar konteks SVG
// (bulatan legend jadi tiada warna). Guna STATUS_COLORS terus mengikut index
// yang sama seperti Cell supaya warna legend sepadan dengan hirisan carta.
const PieLegend = ({ payload }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 16 }}>
    {payload.map((entry, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS[i % STATUS_COLORS.length], flexShrink: 0 }} />
        <span style={{ color: '#374151' }}>{entry.value}</span>
      </div>
    ))}
  </div>
)

// ── Cases Modal ───────────────────────────────────────────────────────────────
function CasesModal({ title, subtitle, filters, onClose }) {
  const navigate = useNavigate()
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCases(filters)
      .then((r) => setCases(r.data.cases || []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/45" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-menu w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-bold text-gray-900">{title}</h3>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-gray-400">Memuatkan...</div>
          ) : cases.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-gray-400">Tiada kes dijumpai.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {cases.map((c) => (
                <div key={c.id}
                  onClick={() => { navigate(`/cases/${c.id}`); onClose() }}
                  className="px-5 py-3.5 hover:bg-gray-50 cursor-pointer flex items-center justify-between gap-3 group">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{c.caseId}</p>
                      <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-primary-600 transition-colors" />
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {c.school?.schoolName}{c.school?.state ? ` · ${c.school.state}` : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(c.createdAt).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <AlertBadge level={c.alertLevel} />
                    <StatusBadge status={c.status} colorMap={CASE_STATUS} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-400">{cases.length} kes</span>
          <button onClick={() => { navigate('/cases'); onClose() }}
            className="text-xs text-primary-600 hover:underline font-medium">
            Lihat Semua Kes →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Dashboard Page ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // { title, subtitle, filters }
  const toast = useToast()

  useEffect(() => {
    getDashboard().then((r) => setData(r.data)).finally(() => setLoading(false))
  }, [])

  // Live updates — a Penyelaras JPN response (POST /cases/:id/respond)
  // triggers sseHub.broadcast('jpn-response', ...) on the backend; patch the
  // KPI counts directly instead of refetching for an instant, snappy update.
  useEffect(() => {
    const source = new EventSource(dashboardStreamUrl())

    source.addEventListener('jpn-response', (e) => {
      const payload = JSON.parse(e.data)
      toast.success(`${payload.schoolName || 'Sekolah'} (${payload.state}) telah menghantar respons rasmi negeri.`)
      setData((d) => d && ({
        ...d,
        escalationsPending: Math.max(0, (d.escalationsPending ?? 1) - 1),
        escalationsResponded: (d.escalationsResponded ?? 0) + 1,
      }))
    })

    return () => source.close()
  }, [toast])

  if (loading) return <PageLoader />

  const alertData = ALERT_ORDER.map((level, i) => ({
    name: level,
    value: data?.byAlert?.find((a) => a.alertLevel === level)?._count || 0,
    fill: KPI_COLORS[i],
  }))

  const openModal = (title, subtitle, filters) => setModal({ title, subtitle, filters })
  const closeModal = () => setModal(null)

  const pendingReview = data?.pendingReview ?? 0
  const jpnPending = data?.escalationsPending ?? 0
  const bannerSubtitle = (pendingReview === 0 && jpnPending === 0)
    ? 'Semua kes telah disemak dan tiada respons Penyelaras JPN tertunggak — tiada tindakan segera diperlukan.'
    : `${pendingReview} kes menunggu semakan${jpnPending > 0 ? ` dan ${jpnPending} respons Penyelaras JPN belum lengkap` : ''} — semak baki tugasan minggu ini.`

  // Same role scoping as Sidebar.jsx's navItems, reshaped into an icon
  // grid for the mobile-only app header below (desktop keeps the sidebar).
  const quickActions = [
    { to: '/ingestion', icon: Database, label: 'Ingestion Data', roles: ['admin', 'peneraju_sektor'], bg: 'bg-primary-100 text-primary-700' },
    { to: '/cases', icon: FileText, label: 'Pengurusan Kes', roles: ['admin', 'peneraju_sektor', 'top_management'], bg: 'bg-warning-100 text-warning-700', badge: data?.pendingReview },
    { to: '/briefs', icon: BookOpen, label: 'Executive Briefs', roles: ['admin', 'peneraju_sektor', 'top_management'], bg: 'bg-success-100 text-success-700', badge: data?.briefsPendingSign },
    { to: '/users', icon: Users, label: 'Pengurusan Pengguna', roles: ['admin'], bg: 'bg-purple-100 text-purple-700' },
  ].filter((q) => q.roles.includes(user?.role))

  const initials = (user?.name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

  return (
    <div className="space-y-6">
      {modal && (
        <CasesModal
          title={modal.title}
          subtitle={modal.subtitle}
          filters={modal.filters}
          onClose={closeModal}
        />
      )}

      {/* Mobile app-header + quick-action grid — replaces the plain h1 +
          PageBanner welcome text on phones (desktop keeps those, below).
          Bleeds edge-to-edge past main's own padding via negative margin. */}
      <div className="md:hidden -mx-4 sm:-mx-6 -mt-4 sm:-mt-6">
        <div className="relative overflow-hidden bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 px-5 pt-6 pb-16 text-white">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -left-8 w-40 h-40 rounded-full bg-primary-400/30 blur-3xl" />
            <div className="absolute -bottom-10 right-0 w-36 h-36 rounded-full bg-warning-300/15 blur-3xl" />
          </div>
          <p className="relative text-xs text-white/70">
            {new Date().toLocaleDateString('ms-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <div className="relative flex flex-col items-center mt-3">
            <div className="w-16 h-16 rounded-full bg-white border-[3px] border-white/50 flex items-center justify-center text-lg font-heading font-bold text-primary-700">
              {initials}
            </div>
            <p className="mt-2 text-[15px] font-heading font-bold">{user?.name}</p>
            <span className="mt-1 text-[10.5px] font-bold uppercase tracking-wide bg-white/20 px-2.5 py-1 rounded-full">
              {ROLES[user?.role]?.label}
            </span>
          </div>
        </div>

        <div className="px-4 -mt-9 relative z-10">
          <div className="bg-white rounded-2xl shadow-card p-4 grid grid-cols-4 gap-2">
            {quickActions.map((q) => (
              <button key={q.to} onClick={() => navigate(q.to)} className="flex flex-col items-center gap-1.5 relative">
                {q.badge > 0 && (
                  <span className="absolute -top-1 right-2 bg-danger-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white">
                    {q.badge}
                  </span>
                )}
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${q.bg}`}>
                  <q.icon className="w-5 h-5" />
                </div>
                <span className="text-[9.5px] font-semibold text-gray-700 text-center leading-tight">{q.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <h1 className="hidden md:block text-xl font-bold text-gray-900">Dashboard</h1>

      <div className="hidden md:block">
        <PageBanner
          title={`Selamat kembali, ${user?.name} 👋`}
          subtitle={bannerSubtitle}
          ctaLabel="Lihat Kes Tertunggak"
          onCta={() => navigate('/cases')}
        />
      </div>

      {/* KPI Cards — clickable */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard icon={FileText} label="Jumlah Kes" value={data?.totalCases ?? 0} color="blue"
          onClick={() => openModal('Semua Kes', 'Senarai keseluruhan kes dalam sistem', {})} />
        <KpiCard icon={Clock} label="Kes Hari Ini" value={data?.todayCases ?? 0} color="indigo"
          onClick={() => openModal('Kes Hari Ini', 'Kes yang dicipta hari ini', { today: true })} />
        <KpiCard icon={AlertTriangle} label="Amaran RED" value={data?.redAlerts ?? 0} color="red"
          onClick={() => openModal('Amaran RED — Ekstrem', 'DI ≥ 0.75 · Tindakan segera diperlukan', { alertLevel: 'RED' })} />
        <KpiCard icon={Clock} label="Menunggu Semakan" value={data?.pendingReview ?? 0} color="orange"
          onClick={() => openModal('Menunggu Semakan', 'Kes yang belum disemak', { status: 'pending' })} />
        <KpiCard icon={MessageSquare} label="Respons Penyelaras JPN" value={data?.escalationsPending ?? 0} color="amber"
          sub={`${data?.escalationsResponded ?? 0} selesai`}
          onClick={() => navigate('/cases')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alert Level Bar Chart */}
        <div className="card p-5" style={{ background: 'linear-gradient(135deg, #fafafa 0%, #fff 100%)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Kes Mengikut Tahap Amaran</h3>
            <span className="text-xs text-gray-400">{alertData.reduce((a, b) => a + b.value, 0)} jumlah</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={alertData} barSize={36} margin={{ top: 4, right: 4, left: -20, bottom: 8 }}>
              <CartesianGrid vertical={false} stroke="#f3f4f6" strokeDasharray="4 2" />
              <XAxis
                dataKey="name"
                tick={({ x, y, payload, index }) => (
                  <g transform={`translate(${x},${y})`}>
                    <circle cx={0} cy={8} r={6} fill={KPI_COLORS[index]} opacity={0.85} />
                    <text x={0} y={22} textAnchor="middle" fontSize={10} fontWeight={600} fill="#374151">
                      {ALERT_LABELS[payload.value]}
                    </text>
                    <text x={0} y={33} textAnchor="middle" fontSize={8} fill="#9ca3af">
                      {ALERT_SUBLABELS[payload.value]}
                    </text>
                  </g>
                )}
                tickLine={false} axisLine={false} height={46}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)', radius: 6 }} />
              <Bar dataKey="value" shape={<RoundedBar />}
                onClick={(entry) => {
                  if (entry.value === 0) return
                  openModal(
                    `Kes Amaran ${ALERT_LABELS[entry.name]}`,
                    `${ALERT_SUBLABELS[entry.name]} · ${entry.value} kes`,
                    { alertLevel: entry.name }
                  )
                }}
                style={{ cursor: 'pointer' }}
              >
                {alertData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status Pie — modern donut */}
        <div className="card p-5" style={{ background: 'linear-gradient(135deg, #fafafa 0%, #fff 100%)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Status Kes</h3>
            <span className="text-xs text-gray-400">{(data?.byStatus || []).reduce((a, b) => a + b._count, 0)} jumlah</span>
          </div>
          {(data?.byStatus || []).length === 0 ? (
            <div style={{ height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
              Tiada data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <defs>
                  {STATUS_COLORS.map((c, i) => (
                    <linearGradient key={i} id={`pieGrad${i}`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={c} stopOpacity={1} />
                      <stop offset="100%" stopColor={c} stopOpacity={0.7} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie
                  data={(data?.byStatus || []).map((s) => ({ name: CASE_STATUS[s.status]?.label || s.status, value: s._count, status: s.status }))}
                  cx="42%" cy="50%"
                  innerRadius={52} outerRadius={82}
                  paddingAngle={3} dataKey="value"
                  labelLine={false} label={<PieLabel />}
                  stroke="none"
                  onClick={(entry) => {
                    if (!entry?.status) return
                    openModal(
                      `Kes — ${CASE_STATUS[entry.status]?.label || entry.status}`,
                      `${entry.value} kes dalam status ini`,
                      { status: entry.status }
                    )
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {(data?.byStatus || []).map((_, i) => (
                    <Cell key={i} fill={`url(#pieGrad${i % STATUS_COLORS.length})`} />
                  ))}
                </Pie>
                <Legend layout="vertical" align="right" verticalAlign="middle" content={<PieLegend />} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 2px 6px 0 rgba(24,24,27,.05), 0 12px 50px 0 rgba(24,24,27,.10)', fontSize: 13 }}
                  formatter={(value, name) => [`${value} kes`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent Cases */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Kes Terbaru</h3>
          <button onClick={() => navigate('/cases')} className="text-xs text-primary-600 hover:underline">Lihat Semua</button>
        </div>
        <div className="divide-y divide-gray-50">
          {(data?.recentCases || []).length === 0 && (
            <p className="text-sm text-gray-400 px-5 py-8 text-center">Tiada kes lagi.</p>
          )}
          {(data?.recentCases || []).map((c) => (
            <div key={c.id} onClick={() => navigate(`/cases/${c.id}`)}
              className="px-5 py-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{c.caseId}</p>
                <p className="text-xs text-gray-500 truncate">
                  {c.school?.schoolName}{c.school?.state ? ` · ${c.school.state}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <AlertBadge level={c.alertLevel} />
                <StatusBadge status={c.status} colorMap={CASE_STATUS} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Briefs pending sign */}
      {user?.role === 'top_management' && data?.briefsPendingSign > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <FileText className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900">{data.briefsPendingSign} Brief Menunggu Tandatangan</p>
              <p className="text-xs text-amber-700">Sila semak dan tandatangani executive briefs yang tertunggak.</p>
            </div>
          </div>
          <button onClick={() => navigate('/briefs')} className="btn-primary text-xs py-1.5 px-3">
            Semak Sekarang
          </button>
        </div>
      )}
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, color, sub, onClick }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600',
    red:    'bg-red-50 text-red-600',
    orange: 'bg-orange-50 text-orange-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    amber:  'bg-warning-50 text-warning-600',
  }
  return (
    <div onClick={onClick}
      className="card p-5 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
      <div className={`w-9 h-9 rounded-lg ${colors[color]} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-success-600 mt-0.5">{sub}</p>}
      <p className="text-xs text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity mt-1">Klik untuk lihat kes →</p>
    </div>
  )
}
