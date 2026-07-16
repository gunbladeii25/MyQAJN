import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Flag, Shield, FileText, CheckCircle, Printer, Zap, X, ExternalLink, Send, Plus, Pencil, Trash2 } from 'lucide-react'
import { GlossaryTip, InfoTip } from '../components/ui/Tooltip'
import {
  getCase, updateCaseStatus, regenerateBrief, respondToEscalation,
  createEscalation, updateEscalation, deleteEscalation, getUsers,
} from '../services/api'
import { useAuthStore } from '../stores/authStore'
import { AlertBadge, DiClassBadge, StatusBadge } from '../components/ui/AlertBadge'
import { CASE_STATUS, ALERT_COLORS } from '../constants'
import { PageLoader } from '../components/ui/Spinner'
import Modal from '../components/ui/Modal'

// ── External JN systems available for escalation ───────────────────────────
// Add your real API endpoints here when ready
const EXTERNAL_SYSTEMS = [
  { id: 'skas',   name: 'SK@S — Sistem Kualiti Pendidikan',   endpoint: '', color: '#2563eb' },
  { id: 'emis',   name: 'EMIS — Education Management Info System', endpoint: '', color: '#7c3aed' },
  { id: 'jpn',    name: 'Portal JPN — Jabatan Pendidikan Negeri',  endpoint: '', color: '#0891b2' },
  { id: 'ppd',    name: 'Portal PPD — Pejabat Pendidikan Daerah',  endpoint: '', color: '#16A34A' },
  { id: 'manual', name: 'Notifikasi Manual (Emel / WhatsApp)',      endpoint: '', color: '#CA8A04' },
]

const URGENCY_LEVELS = [
  { value: 'kritikal', label: '🔴 Kritikal — Tindakan dalam 24 jam', color: '#dc2626' },
  { value: 'tinggi',   label: '🟠 Tinggi — Tindakan dalam 3 hari',   color: '#ea580c' },
  { value: 'sederhana',label: '🟡 Sederhana — Tindakan dalam 7 hari',color: '#ca8a04' },
]

// ── Escalation Modal ──────────────────────────────────────────────────────
function EscalationModal({ caseData, onClose, onConfirm }) {
  const [selSystem, setSelSystem]   = useState(EXTERNAL_SYSTEMS[0].id)
  const [urgency, setUrgency]       = useState('tinggi')
  const [pegawai, setPegawai]       = useState('')
  const [nota, setNota]             = useState('')
  const [apiUrl, setApiUrl]         = useState('')
  const [sending, setSending]       = useState(false)
  const [result, setResult]         = useState(null)
  const [error, setError]           = useState('')

  const sys = EXTERNAL_SYSTEMS.find(s => s.id === selSystem)

  const handleSend = async () => {
    if (!nota.trim()) return setError('Sila masukkan nota tindakan.')
    setError(''); setSending(true)

    const payload = {
      caseId:        caseData.caseId,
      school:        caseData.school?.schoolName,
      schoolCode:    caseData.school?.schoolCode,
      alertLevel:    caseData.alertLevel,
      di:            Number(caseData.discrepancyIndex).toFixed(4),
      diClass:       caseData.diClassification,
      urgency,
      pegawai,
      nota,
      system:        sys.name,
      timestamp:     new Date().toISOString(),
    }

    const targetUrl = apiUrl || sys.endpoint
    if (targetUrl) {
      try {
        await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        setResult({ success: true, url: targetUrl })
      } catch (err) {
        setError(`Gagal hantar ke ${sys.name}: ${err.message}`)
        setSending(false)
        return
      }
    } else {
      // No endpoint configured — log only
      console.log('[Tindakan Segera payload]', payload)
      setResult({ success: true, noEndpoint: true })
    }

    // Update local case status
    await onConfirm()
    setSending(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(3px)',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#fff', borderRadius: 14, width: '100%', maxWidth: 580,
        boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
        margin: '0 16px', display: 'flex', flexDirection: 'column',
        maxHeight: '90vh', overflow: 'hidden',
      }}>
        {/* Modal header */}
        <div style={{
          background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
          padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={18} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, color: '#fff', fontWeight: 800, fontSize: 15 }}>Tindakan Segera — Eskalasi Kes</p>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>{caseData.caseId} · {caseData.school?.schoolName}</p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}>
            <X size={16} color="#fff" />
          </button>
        </div>

        {result ? (
          /* Success state */
          <div style={{ padding: 32, textAlign: 'center', overflowY: 'auto' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <p style={{ fontWeight: 700, fontSize: 16, color: '#18181B', margin: '0 0 8px' }}>Tindakan Segera Dihantar!</p>
            {result.noEndpoint
              ? <p style={{ color: '#6B6B74', fontSize: 13 }}>Endpoint belum dikonfigurasi. Rekod disimpan secara tempatan. Tambah URL endpoint sistem luar untuk penghantaran automatik.</p>
              : <p style={{ color: '#6B6B74', fontSize: 13 }}>Notifikasi berjaya dihantar ke <strong>{sys.name}</strong>.<br/>Status kes telah dikemaskini kepada <strong>Tindakan Segera</strong>.</p>
            }
            <button onClick={onClose} style={{ marginTop: 20, padding: '10px 28px', borderRadius: 8, background: '#DC2626', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
              Tutup
            </button>
          </div>
        ) : (
          <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', flex: 1 }}>
            {/* DI summary strip */}
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#991B1B' }}>DI: <strong style={{ fontSize: 15 }}>{Number(caseData.discrepancyIndex).toFixed(4)}</strong></span>
              <span style={{ fontSize: 12, color: '#991B1B' }}>Tahap: <strong>{caseData.alertLevel}</strong></span>
              <span style={{ fontSize: 12, color: '#991B1B' }}>Anomali: <strong>{caseData.anomalyDetected ? 'DIKESAN' : 'Tidak'}</strong></span>
            </div>

            {/* Target system */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#3F3F46', display: 'block', marginBottom: 8 }}>
                1. Sistem Penerima Eskalasi
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {EXTERNAL_SYSTEMS.map(s => (
                  <label key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8,
                    cursor: 'pointer', border: selSystem === s.id ? `2px solid ${s.color}` : '1px solid #E4E4E7',
                    background: selSystem === s.id ? '#FEF2F2' : '#FAFAFA',
                  }}>
                    <input type="radio" name="sys" value={s.id} checked={selSystem === s.id} onChange={() => setSelSystem(s.id)} />
                    <span style={{ fontSize: 13, fontWeight: selSystem === s.id ? 700 : 400, color: selSystem === s.id ? s.color : '#3F3F46' }}>
                      {s.name}
                    </span>
                    {!s.endpoint && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#A1A1AA', background: '#F4F4F5', padding: '1px 8px', borderRadius: 9999 }}>Endpoint belum set</span>}
                  </label>
                ))}
              </div>
            </div>

            {/* Custom endpoint override */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B6B74', display: 'block', marginBottom: 4 }}>
                API Endpoint (kosongkan jika sudah dikonfigurasi)
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  placeholder="https://sistem-jn.edu.my/api/eskalasi"
                  value={apiUrl} onChange={e => setApiUrl(e.target.value)}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 7, border: '1px solid #D4D4D8', fontSize: 13 }}
                />
                <ExternalLink size={14} color="#A1A1AA" />
              </div>
              <p style={{ fontSize: 11, color: '#A1A1AA', margin: '4px 0 0' }}>
                Endpoint ini akan menerima payload JSON: caseId, school, DI, alertLevel, urgency, nota.
              </p>
            </div>

            {/* Urgency */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#3F3F46', display: 'block', marginBottom: 8 }}>
                2. Tahap Kecemasan
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {URGENCY_LEVELS.map(u => (
                  <button key={u.value} onClick={() => setUrgency(u.value)} style={{
                    padding: '7px 14px', borderRadius: 8, border: urgency === u.value ? `2px solid ${u.color}` : '1px solid #E4E4E7',
                    background: urgency === u.value ? u.color + '15' : '#fff',
                    cursor: 'pointer', fontSize: 12, fontWeight: urgency === u.value ? 700 : 400,
                    color: urgency === u.value ? u.color : '#3F3F46',
                  }}>
                    {u.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Officer */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#3F3F46', display: 'block', marginBottom: 6 }}>
                3. Pegawai Bertanggungjawab (pilihan)
              </label>
              <input placeholder="Nama pegawai yang dipertanggungjawabkan…"
                value={pegawai} onChange={e => setPegawai(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #D4D4D8', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>

            {/* Notes */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#3F3F46', display: 'block', marginBottom: 6 }}>
                4. Nota Tindakan <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea rows={3} placeholder="Huraikan tindakan segera yang perlu diambil…"
                value={nota} onChange={e => setNota(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #D4D4D8', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>

            {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: 7, fontSize: 13 }}>{error}</div>}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #D4D4D8', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
                Batal
              </button>
              <button onClick={handleSend} disabled={sending || !nota.trim()} style={{
                padding: '10px 22px', borderRadius: 8, border: 'none', cursor: sending ? 'wait' : 'pointer',
                background: sending ? '#FCA5A5' : 'linear-gradient(135deg, #DC2626, #B91C1C)',
                color: '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
                opacity: !nota.trim() ? 0.5 : 1,
              }}>
                <Send size={14} />
                {sending ? 'Menghantar…' : 'Hantar Tindakan Segera'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CaseDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [caseData, setCaseData]     = useState(null)
  const [loading, setLoading]           = useState(true)
  const [showEscModal, setShowEscModal] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [respondModal, setRespondModal] = useState(false)
  const [escModal, setEscModal] = useState(null) // { type: 'add'|'edit'|'delete', escalation? }

  const load = () => getCase(id).then((r) => setCaseData(r.data.case)).finally(() => setLoading(false))

  useEffect(() => { load() }, [id])

  if (loading) return <PageLoader />
  if (!caseData) return <p className="text-center text-gray-500 mt-10">Kes tidak dijumpai.</p>

  const c = caseData
  const alertColor = ALERT_COLORS[c.alertLevel]
  const brief = c.executiveBrief

  const handleStatusUpdate = async (status) => {
    await updateCaseStatus(id, status)
    load()
  }

  const handleRegenerateBrief = async () => {
    setRegenerating(true)
    try {
      await regenerateBrief(id)
      await load()
    } catch (e) {
      alert('Gagal jana semula surat. Pastikan AI engine berjalan.')
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/cases')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-lg font-bold text-gray-900 font-mono">{c.caseId}</h1>
            <AlertBadge level={c.alertLevel} size="md" />
            <StatusBadge status={c.status} colorMap={CASE_STATUS} />
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{c.school?.schoolName} ({c.school?.schoolCode})</p>
        </div>
      </div>

      {/* DI Summary Banner — mobile shows a gauge + stat-tile grid (a raw
          "0.3173" reads slower on a phone than a ring you can eyeball at
          a glance); desktop keeps the original flex-wrap row unchanged. */}
      <div className={`rounded-xl border p-5 ${alertColor.bg} ${alertColor.border}`}>
        <div className="sm:hidden flex flex-col items-center text-center mb-4">
          <DiGauge value={Number(c.discrepancyIndex)} level={c.alertLevel} />
          <div className="mt-2"><DiClassBadge classification={c.diClassification} /></div>
          <div className="grid grid-cols-3 gap-2 mt-4 w-full">
            <div className="bg-white/60 rounded-lg py-2 px-1">
              <p className="text-[10px] text-gray-500">Skor Operasi</p>
              <p className="text-sm font-bold text-gray-800 mt-0.5">{Number(c.operationalScore).toFixed(1)}</p>
            </div>
            <div className="bg-white/60 rounded-lg py-2 px-1">
              <p className="text-[10px] text-gray-500">Skor Audit JN</p>
              <p className="text-sm font-bold text-gray-800 mt-0.5">{Number(c.jnAuditScore).toFixed(1)}</p>
            </div>
            <div className="bg-white/60 rounded-lg py-2 px-1">
              <p className="text-[10px] text-gray-500">Anomali</p>
              <p className={`text-sm font-bold mt-0.5 ${c.anomalyDetected ? 'text-danger-700' : 'text-success-700'}`}>{c.anomalyDetected ? 'YA' : 'TIDAK'}</p>
            </div>
          </div>
        </div>

        <div className="hidden sm:flex flex-wrap items-center gap-6">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${alertColor.text}`}>Discrepancy Index</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{Number(c.discrepancyIndex).toFixed(4)}</p>
          </div>
          <div className="h-10 w-px bg-gray-200" />
          <div><p className="text-xs text-gray-500">Skor Operasi</p><p className="text-xl font-bold text-gray-800">{Number(c.operationalScore).toFixed(1)}</p></div>
          <div><p className="text-xs text-gray-500">Skor Audit JN</p><p className="text-xl font-bold text-gray-800">{Number(c.jnAuditScore).toFixed(1)}</p></div>
          <div><p className="text-xs text-gray-500">Anomali</p><p className={`text-base font-bold ${c.anomalyDetected ? 'text-danger-700' : 'text-success-700'}`}>{c.anomalyDetected ? 'DIKESAN' : 'TIDAK'}</p></div>
          <div><p className="text-xs text-gray-500">Klasifikasi</p><DiClassBadge classification={c.diClassification} /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Agent A */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Agent A — Ingesti Semantik</h3>
          </div>
          <div className="space-y-2.5 text-sm">
            <Row label="Kategori" value={c.category?.replace('_', ' ')} />
            <Row label="Keterukan" value={c.severity} />
            <Row label={<><GlossaryTip term="Confidence (ML)">Confidence (ML)</GlossaryTip></>} value={`${(Number(c.agentAConfidence) * 100).toFixed(1)}%`} />
            <Row label="Kaedah" value={<GlossaryTip term="rule_based">{c.agentAOutput?.classification_method || 'rule_based'}</GlossaryTip>} />
            <Row label="Checksum" value={<span className="font-mono text-xs text-gray-500">{c.payloadChecksum}</span>} />
          </div>
        </div>

        {/* Agent B */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-warning-100 flex items-center justify-center">
              <Flag className="w-4 h-4 text-warning-700" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Agent B — Pengesanan Anomali</h3>
          </div>
          <div className="space-y-2.5 text-sm">
            <Row label={<><GlossaryTip term="DI">DI Value</GlossaryTip></>} value={<span className="font-mono">{Number(c.discrepancyIndex).toFixed(4)}</span>} />
            <Row label={<><GlossaryTip term="Anomaly Score (IF)">Anomaly Score (IF)</GlossaryTip></>} value={<span className="font-mono">{Number(c.anomalyScore).toFixed(4)}</span>} />
            <Row label={<><GlossaryTip term="Confidence">Confidence</GlossaryTip></>} value={`${(Number(c.agentBConfidence) * 100).toFixed(1)}%`} />
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Risk Flags ({(c.riskFlags || []).length})</p>
              {(c.riskFlags || []).length === 0
                ? <span className="text-xs text-success-600">Tiada flag</span>
                : <div className="flex flex-wrap gap-1">
                    {(c.riskFlags || []).map((f) => (
                      <span key={f} className="text-xs bg-danger-50 text-danger-700 border border-danger-200 rounded px-2 py-0.5 font-mono">{f}</span>
                    ))}
                  </div>
              }
            </div>
          </div>
        </div>
      </div>

      {/* Incident Text */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Teks Laporan Insiden</h3>
        <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-4 whitespace-pre-wrap">{c.incidentText}</p>
      </div>

      {/* Executive Brief — Surat Arahan Rasmi */}
      {brief && <OfficialLetter brief={brief} caseData={c} user={user} navigate={navigate} onRegenerate={handleRegenerateBrief} regenerating={regenerating} />}

      {/* Eskalasi Penyelaras JPN Negeri */}
      {((c.escalations || []).length > 0 || user?.role === 'admin') && (
        <StateEscalationCard
          escalations={c.escalations || []}
          user={user}
          onRespond={() => setRespondModal(true)}
          onAdd={() => setEscModal({ type: 'add' })}
          onEdit={(esc) => setEscModal({ type: 'edit', escalation: esc })}
          onDelete={(esc) => setEscModal({ type: 'delete', escalation: esc })}
        />
      )}
      {respondModal && (
        <RespondEscalationModal
          caseId={c.id}
          onClose={() => setRespondModal(false)}
          onSuccess={() => { setRespondModal(false); load() }}
        />
      )}
      {escModal?.type === 'add' && (
        <AddEscalationModal
          caseId={c.id}
          onClose={() => setEscModal(null)}
          onSuccess={() => { setEscModal(null); load() }}
        />
      )}
      {escModal?.type === 'edit' && (
        <EditEscalationModal
          caseId={c.id}
          escalation={escModal.escalation}
          onClose={() => setEscModal(null)}
          onSuccess={() => { setEscModal(null); load() }}
        />
      )}
      {escModal?.type === 'delete' && (
        <DeleteEscalationModal
          caseId={c.id}
          escalation={escModal.escalation}
          onClose={() => setEscModal(null)}
          onSuccess={() => { setEscModal(null); load() }}
        />
      )}

      {/* Status update — active cases */}
      {['admin', 'peneraju_sektor'].includes(user?.role) && c.status !== 'closed' && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Kemas Kini Status</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(CASE_STATUS).filter(([k]) => k !== c.status).map(([k, v]) => {
              if (k === 'escalated') {
                return (
                  <button key={k} onClick={() => setShowEscModal(true)}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-md border-[1.5px] border-warning-600 bg-gradient-to-br from-warning-50 to-white cursor-pointer text-warning-700 font-bold text-[13px]">
                    <Zap size={13} />
                    {v.label}
                  </button>
                )
              }
              return (
                <button key={k} onClick={() => handleStatusUpdate(k)} className="btn-secondary text-xs py-1.5">
                  Tandakan sebagai: {v.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Reopen — admin only, closed cases */}
      {user?.role === 'admin' && c.status === 'closed' && (
        <div className="card p-5 bg-gray-50">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-700">Kes Ditutup</p>
              <p className="text-xs text-gray-400 mt-0.5">Hanya Administrator boleh membuka semula kes yang telah ditutup.</p>
            </div>
            <button
              onClick={() => handleStatusUpdate('pending')}
              className="flex items-center gap-1.5 px-[18px] py-2 rounded-md border-[1.5px] border-primary-600 bg-primary-50 cursor-pointer text-primary-700 font-bold text-sm">
              🔓 Buka Semula Kes
            </button>
          </div>
        </div>
      )}

      {/* Escalation modal */}
      {showEscModal && (
        <EscalationModal
          caseData={c}
          onClose={() => setShowEscModal(false)}
          onConfirm={async () => {
            await handleStatusUpdate('escalated')
            setShowEscModal(false)
          }}
        />
      )}
    </div>
  )
}

// ── Letter Formatting Helpers ─────────────────────────────────────────────────
// Follows standard Malaysian Government formal letter (Surat Rasmi Kerajaan) format:
//   Main paragraphs   → 1.  2.  3.
//   Sub-list          → a)  b)  c)
//   Sub-sub (legal)   → i)  ii) iii)

const LETTER_STYLES = {
  // ── Container ──
  page: {
    fontFamily: "'Times New Roman', 'Georgia', serif",
    fontSize: 11.5,
    color: '#000',
    lineHeight: 1.85,
  },
  // ── Letterhead table ──
  logoCell: { width: 120, verticalAlign: 'middle', paddingRight: 18 },
  logoImg:  { width: 110, height: 'auto', display: 'block' },
  ministryName: { fontWeight: 700, fontSize: 13, color: '#000', letterSpacing: 0.4 },
  deptName:     { fontWeight: 700, fontSize: 13, color: '#000', letterSpacing: 0.4, marginBottom: 6 },
  addressText:  { fontSize: 9.5, lineHeight: 1.7, color: '#111' },
  contactCell:  { verticalAlign: 'top', textAlign: 'right', fontSize: 9.5, color: '#111', whiteSpace: 'nowrap', lineHeight: 2.1 },
  divider:      { border: 'none', borderTop: '2.5px double #000', margin: '10px 0 20px' },

  // ── Reference ──
  refValue:     { fontWeight: 700 },

  // ── Recipient block (right side, beside Tarikh) ──
  recipientTitle: { fontWeight: 700, fontSize: 11.5 },

  // ── Salutation ──
  salutation: { marginBottom: 18, fontSize: 11 },

  // ── Subject ──
  subject: { fontWeight: 700, textDecoration: 'underline', textTransform: 'uppercase', marginBottom: 22, fontSize: 11.5, lineHeight: 1.7 },

  // ── Body ──
  bodyWrap: { fontSize: 11, lineHeight: 2.0, textAlign: 'justify' },

  // ── Closing ──
  closingWrap:  { marginTop: 30, fontSize: 11, lineHeight: 2.0 },
  motto:        { fontWeight: 700, marginTop: 2 },

  // ── Signature ──
  sigWrap:       { marginTop: 18, fontSize: 11, lineHeight: 2.0 },
  sigLine:       { marginTop: 50, borderTop: '1px solid #000', width: 220, marginBottom: 6 },
  sigName:       { fontWeight: 700, fontSize: 11.5 },
  sigPost:       { fontWeight: 600 },

  // ── Status chips ──
  chipRow:     { marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' },
  chipSigned:  { fontSize: 10, background: '#dcfce7', color: '#166534', padding: '3px 12px', borderRadius: 9999, border: '1px solid #bbf7d0' },
  draftWarn:   { marginTop: 16, textAlign: 'center', fontSize: 10, color: '#b91c1c', border: '1px solid #fca5a5', background: '#fff5f5', padding: '8px 14px', borderRadius: 6 },
}

// Numbered Paragraph:  "1.  content"
function LetterPara({ n, children }) {
  return (
    <div style={{ display: 'flex', marginBottom: 14, alignItems: 'flex-start' }}>
      <span style={{ minWidth: 32, flexShrink: 0, fontWeight: 500, textAlign: 'right', paddingRight: 8 }}>
        {n !== '' && n != null ? `${n}.` : ''}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

// Alpha sub-list: a) …  b) …  with optional i) legal reference
function AlphaList({ items, toStr }) {
  const alphaChar = (i) => String.fromCharCode(97 + i)
  return (
    <div style={{ marginTop: 6 }}>
      {(items || []).map((item, ai) => {
        const text    = toStr(item)
        const subText = (typeof item === 'object' && item !== null && item.legal) ? item.legal : null
        return (
          <div key={ai} style={{ display: 'flex', marginBottom: 9 }}>
            <span style={{ minWidth: 32, flexShrink: 0, paddingRight: 4 }}>{alphaChar(ai)})</span>
            <div style={{ flex: 1 }}>
              <span>{text}</span>
              {subText && (
                <div style={{ display: 'flex', marginTop: 4, marginLeft: 6 }}>
                  <span style={{ minWidth: 32, flexShrink: 0, color: '#444' }}>i)</span>
                  <span style={{ color: '#333', fontStyle: 'italic' }}>{subText}</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Official Letter Component ─────────────────────────────────────────────────
function OfficialLetter({ brief, caseData, user, navigate, onRegenerate, regenerating }) {
  const letterRef = useRef(null)

  // Parse directive JSON — already parsed by backend or fallback
  const directive = (brief.directiveText && typeof brief.directiveText === 'object')
    ? brief.directiveText
    : (() => { try { return JSON.parse(brief.directiveText || '{}') } catch { return {} } })()

  // Convert any item (string | {flag,legal,action}) to displayable text
  // Bentuk JSON Ollama tidak konsisten antara panggilan — {id, arahan},
  // {flag, legal, action}, {domain_skpm, tindakan: [...]} (bersarang),
  // {nama_undang_undang, pasal}, dll. Rekursif supaya senarai tindakan
  // bersarang tidak hilang senyap (sepadan dengan _itemToText di
  // backend stateEscalation.js).
  const toStr = (item) => {
    if (item === null || item === undefined) return ''
    if (typeof item === 'string') return item
    if (Array.isArray(item)) return item.map(toStr).filter(Boolean).join('; ')
    if (typeof item === 'object') {
      if (item.action) return toStr(item.action)
      if (item.arahan) return toStr(item.arahan)
      if (item.pasal) return item.nama_undang_undang ? `${item.nama_undang_undang} — ${item.pasal}` : item.pasal
      const title = item.domain_skpm || item.standard_skpm || item.flag || item.label
      const body = item.tindakan || item.tindakan_khusus || item.details
      if (title && body) return `${title}: ${toStr(body)}`
      if (title) return title
      return Object.values(item).map(toStr).filter(Boolean).join(' — ')
    }
    return String(item)
  }

  // Sanitize legacy product name
  const fixed = (s) => (typeof s === 'string' ? s.replace(/PRESTIJ-25/gi, 'MyQA@JN').replace(/PRESTIJ25/gi, 'MyQA@JN').replace(/MyResJN/gi, 'MyQA@JN') : s)

  // ── Dates ──
  const today = new Date()
  const bulan = ['Januari','Februari','Mac','April','Mei','Jun','Julai','Ogos','September','Oktober','November','Disember']
  const dateStr   = `${today.getDate()} ${bulan[today.getMonth()]} ${today.getFullYear()}`
  const refNo     = `KP(JN)${(caseData.caseId || '').replace('JN-', '').replace(/-/g, '/')}`

  // ── Dynamic paragraph numbering ──
  let nextN = 1
  const N = () => nextN++

  const hasEnforcement = (brief.enforcementActions || []).length > 0
  const hasPolicy      = (brief.policyRecommendations || []).length > 0
  const hasTempoh      = !!directive.tempoh_tindakan
  const hasLegal       = (brief.legalReferences || []).length > 0

  // ── Print handler ──
  const handlePrint = () => {
    const content = letterRef.current.innerHTML
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Surat Arahan — ${caseData.caseId}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Times New Roman',Georgia,serif; font-size:12pt; color:#000; background:#fff; }
  .letter-page { max-width:720px; margin:0 auto; padding:48px 56px; }
  .lh-table { width:100%; border-collapse:collapse; margin-bottom:14px; }
  .lh-table td { padding:0; }
  .lh-logo { width:120pt; vertical-align:middle; padding-right:18pt; }
  .lh-logo img { width:112pt; height:auto; display:block; }
  .lh-name { font-weight:bold; font-size:12.5pt; letter-spacing:.3pt; }
  .lh-dept { font-weight:bold; font-size:12.5pt; letter-spacing:.3pt; margin-bottom:6pt; }
  .lh-addr { font-size:10pt; line-height:1.7; color:#111; }
  .lh-contact { vertical-align:top; text-align:right; font-size:10pt; color:#111; white-space:nowrap; line-height:2.1; }
  .divider { border:none; border-top:2.5px double #000; margin:10pt 0 20pt; }
  .ref-container { display:flex; margin-bottom:18pt; font-size:11pt; }
  .ref-left  { flex:0 0 45%; }
  .ref-right { flex:1; line-height:2.0; }
  .ref-line  { margin-bottom:10pt; }
  .salute { margin-bottom:18pt; font-size:11pt; }
  .subj { font-weight:bold; text-decoration:underline; text-transform:uppercase; margin-bottom:22pt; font-size:11.5pt; line-height:1.7; }
  .body-wrap { font-size:11pt; line-height:2.0; text-align:justify; }
  .body-para { display:flex; margin-bottom:14pt; align-items:flex-start; }
  .body-num { min-width:32pt; flex-shrink:0; font-weight:500; text-align:right; padding-right:8pt; }
  .body-text { flex:1; }
  .alpha-item { display:flex; margin-bottom:9pt; }
  .alpha-num { min-width:32pt; flex-shrink:0; padding-right:4pt; }
  .alpha-text { flex:1; }
  .roman-item { display:flex; margin-top:4pt; margin-left:6pt; }
  .roman-num { min-width:32pt; flex-shrink:0; color:#444; }
  .roman-text { color:#333; font-style:italic; }
  .closing { margin-top:30pt; font-size:11pt; line-height:2.0; }
  .motto { font-weight:bold; margin-top:2pt; }
  .sig-wrap { margin-top:18pt; font-size:11pt; line-height:2.0; }
  .sig-line { margin-top:50pt; border-top:1px solid #000; width:220pt; margin-bottom:6pt; }
  .sig-name { font-weight:bold; font-size:11.5pt; }
  .sig-post { font-weight:600; }
  @media print { body { margin:0; } .letter-page { padding:36pt 48pt; } }
</style></head>
<body><div class="letter-page">${content}</div></body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 600)
  }

  // ── Render ──
  const S = LETTER_STYLES

  return (
    <div className="card overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center">
            <FileText className="w-4 h-4 text-purple-600" />
          </div>
          <span className="text-sm font-semibold text-gray-900">Agent C — Surat Arahan Rasmi</span>
          <GlossaryTip term={brief.llmModelUsed}>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{brief.llmModelUsed}</span>
          </GlossaryTip>
        </div>
        <div className="flex items-center gap-2">
          {brief.signedByKetuaJn && (
            <span className="text-xs bg-success-100 text-success-700 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Ketua Nazir Sekolah
            </span>
          )}
          {brief.signedByAuditDirector && (
            <span className="text-xs bg-success-100 text-success-700 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Nazir Pemeriksa
            </span>
          )}
          {['admin', 'peneraju_sektor'].includes(user?.role) && (
            <button onClick={onRegenerate} disabled={regenerating}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50">
              {regenerating ? '⏳ Menjana...' : '🤖 Jana Semula'}
            </button>
          )}
          <button onClick={handlePrint}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
            <Printer className="w-3.5 h-3.5" /> Cetak
          </button>
          {user?.role === 'top_management' && (!brief.signedByKetuaJn || !brief.signedByAuditDirector) && (
            <button onClick={() => navigate('/briefs')} className="btn-primary text-xs py-1.5">
              Tandatangan
            </button>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          LETTER BODY — Surat Rasmi Kerajaan Malaysia
          ════════════════════════════════════════════════════════════════════ */}
      <div className="p-6 bg-white" style={S.page}>
        <div ref={letterRef}>

          {/* ── 1. LETTERHEAD (Kepala Surat) ── */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
            <tbody>
              <tr>
                <td style={S.logoCell}>
                  <img src="/KPMJN-Hitam.png" alt="Jata KPM Jemaah Nazir" style={S.logoImg} />
                </td>
                <td style={{ verticalAlign: 'top' }}>
                  <div style={S.ministryName}>KEMENTERIAN PENDIDIKAN</div>
                  <div style={S.deptName}>JEMAAH NAZIR</div>
                  <div style={S.addressText}>
                    ARAS 3-5, BLOK E15, KOMPLEKS KERAJAAN PARCEL E<br />
                    PUSAT PENTADBIRAN KERAJAAN PERSEKUTUAN<br />
                    62604 PUTRAJAYA
                  </div>
                </td>
                <td style={S.contactCell}>
                  <div>Telefon : +603-8884 4139</div>
                  <div>Faks &nbsp;&nbsp;&nbsp;: +603-8888 6867</div>
                </td>
              </tr>
            </tbody>
          </table>

          <hr style={S.divider} />

          {/* ── 2. PENERIMA, RUJUKAN & TARIKH ── */}
          {/* Recipient (left)  |  Ruj. Kami + Tarikh (right) */}
          <div style={{ display: 'flex', marginBottom: 18, fontSize: 11 }}>
            {/* Left: Recipient */}
            <div style={{ flex: 1, lineHeight: 2.0, paddingRight: 16 }}>
              <div style={S.recipientTitle}>
                {toStr(directive.penerima) || 'PENGETUA / GURU BESAR'}
              </div>
              <div style={{ fontWeight: 600 }}>
                {caseData.school?.schoolName?.toUpperCase()}
              </div>
              <div style={{ color: '#333' }}>
                ({caseData.school?.schoolCode})
              </div>
            </div>
            {/* Right: Ruj. Kami (top) + Tarikh (below) */}
            <div style={{ flex: '0 0 40%', textAlign: 'right' }}>
              <div style={{ marginBottom: 6 }}>
                Ruj. Kami &nbsp;: <strong style={S.refValue}>{refNo}</strong>
              </div>
              <div>
                Tarikh &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {dateStr}
              </div>
            </div>
          </div>

          {/* ── 4. SALUTATION ── */}
          <div style={S.salutation}>Tuan/Puan,</div>

          {/* ── 5. TAJUK / PERKARA (Subject) ── */}
          <div style={S.subject}>
            {fixed(toStr(directive.perkara)) || `ARAHAN TINDAKAN SUSULAN — DISCREPANCY INDEX ${caseData.caseId}`}
          </div>

          {/* ── 6. ISI KANDUNGAN (Body) ── */}
          <div style={S.bodyWrap}>

            {/* 1. Pembuka */}
            <LetterPara n={N()}>
              Dengan hormatnya saya merujuk kepada perkara di atas.
            </LetterPara>

            {/* 2. Penemuan Utama */}
            <LetterPara n={N()}>
              Dimaklumkan bahawa hasil pemantauan dan penilaian berterusan melalui sistem{' '}
              <strong>MyQA@JN</strong>,{' '}
              <strong>{caseData.school?.schoolName} ({caseData.school?.schoolCode})</strong>{' '}
              telah direkodkan dengan{' '}
              <strong>Indeks Perbezaan (Discrepancy Index, DI)</strong> pada nilai{' '}
              <strong>{Number(caseData.discrepancyIndex).toFixed(4)}</strong>{' '}
              yang dikelaskan sebagai{' '}
              <strong style={{ textTransform: 'uppercase' }}>
                {caseData.diClassification?.replace(/_/g, ' ')}
              </strong>{' '}
              ({caseData.alertLevel}).
            </LetterPara>

            {/* 3. Arahan umum (dari LLM / fallback) */}
            <LetterPara n={N()}>
              {fixed(toStr(directive.arahan_umum)) ||
                'Sehubungan dengan itu, tuan/puan adalah dengan ini diarahkan untuk mengambil tindakan segera bagi menangani perbezaan data yang dikenal pasti dan memastikan pematuhan sepenuhnya kepada standard kualiti pendidikan yang ditetapkan oleh Kementerian Pendidikan Malaysia.'}
            </LetterPara>

            {/* 4. Enforcement Actions */}
            {hasEnforcement && (
              <LetterPara n={N()}>
                <strong>Tindakan penguatkuasaan</strong> yang perlu dilaksanakan dengan kadar segera adalah seperti berikut:
                <AlphaList items={brief.enforcementActions} toStr={toStr} />
              </LetterPara>
            )}

            {/* 5. Policy Recommendations */}
            {hasPolicy && (
              <LetterPara n={N()}>
                <strong>Cadangan dasar</strong> untuk penambahbaikan berterusan adalah seperti berikut:
                <AlphaList items={brief.policyRecommendations} toStr={toStr} />
              </LetterPara>
            )}

            {/* 6. Tempoh Tindakan */}
            {hasTempoh && (
              <LetterPara n={N()}>
                {toStr(directive.tempoh_tindakan)}
              </LetterPara>
            )}

            {/* 7. Legal References */}
            {hasLegal && (
              <LetterPara n={N()}>
                Tindakan ini adalah berdasarkan peruntukan undang-undang dan pekeliling yang berkuat kuasa:
                <ul style={{ marginTop: 8, marginLeft: 28, listStyleType: 'disc' }}>
                  {(brief.legalReferences || []).map((r, i) => (
                    <li key={i} style={{ marginBottom: 5 }}>{toStr(r)}</li>
                  ))}
                </ul>
              </LetterPara>
            )}

            {/* Penutup (no number) */}
            <LetterPara n="">
              {fixed(toStr(directive.nota_penutup)) ||
                'Dokumen ini dijana secara automatik oleh sistem MyQA@JN dan <strong>MESTI</strong> disemak serta ditandatangani oleh pegawai yang bertanggungjawab sebelum pengedaran rasmi.'}
            </LetterPara>
          </div>

          {/* ── 7. PENUTUP (Closing) ── */}
          <div style={S.closingWrap}>
            <p>Sekian, terima kasih.</p>
            <p style={S.motto}>"MALAYSIA MADANI"</p>
            <p style={S.motto}>"BERKHIDMAT UNTUK NEGARA"</p>
          </div>

          {/* ── 8. TANDATANGAN (Signature) ── */}
          <div style={S.sigWrap}>
            <p>Saya yang menjalankan amanah,</p>
            <div style={S.sigLine} />
            <div style={S.sigName}>(NAHARUDEEN BIN OTHMAN, S.M.P)</div>
            <div style={S.sigPost}>Ketua Nazir Sekolah</div>
            <div>Kementerian Pendidikan Malaysia</div>
          </div>

          {/* ── 9. STATUS TANDATANGAN / DRAFT ── */}
          {(brief.signedByKetuaJn || brief.signedByAuditDirector) && (
            <div style={S.chipRow}>
              {brief.signedByKetuaJn && (
                <span style={S.chipSigned}>✓ Ditandatangani: Ketua Nazir Sekolah</span>
              )}
              {brief.signedByAuditDirector && (
                <span style={S.chipSigned}>✓ Ditandatangani: Nazir Pemeriksa</span>
              )}
            </div>
          )}

          {!brief.signedByKetuaJn && !brief.signedByAuditDirector && (
            <div style={S.draftWarn}>
              ⚠ DRAF — Belum ditandatangani. Tidak sah untuk pengedaran rasmi.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-gray-900 font-medium text-right">{value}</span>
    </div>
  )
}

// Mobile-only DI visualisation (see the DI Summary Banner above) — matches
// the ALERT_COLORS hue per level so it agrees with the AlertBadge/DiClassBadge
// shown right next to it, just as a hex since SVG stroke can't take a
// Tailwind class.
const DI_GAUGE_HEX = { RED: '#DC2626', ORANGE: '#EA580C', YELLOW: '#CA8A04', BLUE: '#2563EB', GREEN: '#16A34A' }
function DiGauge({ value, level }) {
  const color = DI_GAUGE_HEX[level] || '#6B6B74'
  const pct = Math.min(1, Math.max(0, value))
  const r = 38
  const circumference = 2 * Math.PI * r
  return (
    <div className="relative w-24 h-24">
      <svg width="96" height="96" viewBox="0 0 96 96" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="48" cy="48" r={r} fill="none" stroke="#E4E4E7" strokeWidth="9" />
        <circle
          cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-heading font-bold text-gray-900">{value.toFixed(3)}</span>
        <span className="text-[9px] text-gray-400 font-semibold tracking-wide">DI SCORE</span>
      </div>
    </div>
  )
}

// ── Eskalasi Penyelaras JPN Negeri ────────────────────────────────────────────
// Kes dieskalasi ke PIC PERINGKAT NEGERI (bukan PIC sekolah — dengan ~10k
// sekolah, notifikasi terus ke setiap sekolah tidak berskala). Kad ini
// memaparkan status e-mel + respons setiap Penyelaras JPN yang dinotifikasi.
const EMAIL_STATUS_LABEL = {
  sent:    { label: 'E-mel Dihantar',   color: 'bg-success-100 text-success-700' },
  skipped: { label: 'Log Sahaja (Dev)', color: 'bg-gray-100 text-gray-600' },
  failed:  { label: 'E-mel Gagal',      color: 'bg-danger-100 text-danger-700' },
  pending: { label: 'Memproses…',       color: 'bg-warning-100 text-warning-700' },
}

function StateEscalationCard({ escalations, user, onRespond, onAdd, onEdit, onDelete }) {
  const isAdmin = user?.role === 'admin'
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-gray-900">Eskalasi Penyelaras JPN Negeri</h3>
        {isAdmin && (
          <button onClick={onAdd} className="flex items-center gap-1 text-xs px-2.5 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">
            <Plus className="w-3.5 h-3.5" /> Tambah PIC
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400 mb-3">Kes dilaporkan kepada PIC peringkat negeri tempat sekolah berada.</p>
      {escalations.length === 0 && (
        <p className="text-sm text-gray-400 italic">Tiada rekod eskalasi bagi kes ini.</p>
      )}
      <div className="space-y-2.5">
        {escalations.map((esc, i) => {
          const isMine = user?.role === 'penyelaras_jpn' && esc.user?.email === user?.email
          const noPic = !esc.user
          const emailStatus = EMAIL_STATUS_LABEL[esc.emailStatus] || EMAIL_STATUS_LABEL.pending
          return (
            <div key={esc.id || i} className="border border-gray-100 rounded-lg p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {noPic ? `Negeri ${esc.state} — tiada PIC berdaftar` : `${esc.user.name} — Penyelaras JPN ${esc.state}`}
                  </p>
                  {!noPic && <p className="text-xs text-gray-400">{esc.user.email}</p>}
                  {noPic && esc.emailError && <p className="text-xs text-danger-600 mt-0.5">{esc.emailError}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${emailStatus.color}`}>{emailStatus.label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${esc.status === 'responded' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}`}>
                    {esc.status === 'responded' ? 'Telah Respons' : 'Menunggu Respons'}
                  </span>
                  {isAdmin && (
                    <>
                      <button onClick={() => onEdit(esc)} title="Sunting" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onDelete(esc)} title="Padam" className="p-1.5 hover:bg-danger-50 text-danger-600 rounded-lg">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {esc.responseText && (
                <div className="mt-2 bg-primary-50 border border-primary-100 rounded-lg p-3">
                  <p className="text-xs font-medium text-primary-900 mb-1">
                    Respons {esc.user?.name} · {esc.respondedAt ? new Date(esc.respondedAt).toLocaleDateString('ms-MY') : ''}
                  </p>
                  <p className="text-sm text-primary-800 whitespace-pre-wrap">{esc.responseText}</p>
                </div>
              )}
              {isMine && esc.status !== 'responded' && (
                <button onClick={onRespond} className="btn-primary text-xs py-1.5 mt-2">
                  Beri Respons Rasmi Negeri
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Admin CRUD Modals (Eskalasi) ──────────────────────────────────────────
function AddEscalationModal({ caseId, onClose, onSuccess }) {
  const [pics, setPics] = useState([])
  const [userId, setUserId] = useState('')
  const [loadingPics, setLoadingPics] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getUsers({ role: 'penyelaras_jpn', limit: 100 })
      .then((r) => setPics(r.data.users))
      .finally(() => setLoadingPics(false))
  }, [])

  const handleSubmit = async () => {
    if (!userId) return setError('Sila pilih Penyelaras JPN.')
    setSubmitting(true); setError('')
    try {
      await createEscalation(caseId, { userId })
      onSuccess()
    } catch (e) {
      setError(e.response?.data?.error || 'Gagal menambah PIC.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Tambah PIC Eskalasi">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          PIC yang ditambah akan terus menerima e-mel eskalasi bagi kes ini.
        </p>
        {loadingPics ? (
          <p className="text-sm text-gray-400">Memuatkan senarai Penyelaras JPN...</p>
        ) : (
          <select className="input" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">— Pilih Penyelaras JPN —</option>
            {pics.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {p.state} ({p.email})</option>
            ))}
          </select>
        )}
        {error && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-3">{error}</div>}
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Batal</button>
          <button onClick={handleSubmit} disabled={submitting || loadingPics} className="btn-primary">
            {submitting ? 'Menambah...' : 'Tambah & Hantar E-mel'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

const ESCALATION_STATUS_OPTIONS = [
  { value: 'pending', label: 'Menunggu Respons' },
  { value: 'responded', label: 'Telah Respons' },
]

function EditEscalationModal({ caseId, escalation, onClose, onSuccess }) {
  const [state, setState] = useState(escalation.state || '')
  const [status, setStatus] = useState(escalation.status || 'pending')
  const [responseText, setResponseText] = useState(escalation.responseText || '')
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setSubmitting(true); setError('')
    try {
      await updateEscalation(caseId, escalation.id, { state, status, responseText })
      onSuccess()
    } catch (e) {
      setError(e.response?.data?.error || 'Gagal mengemas kini rekod.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    setResending(true); setError('')
    try {
      await updateEscalation(caseId, escalation.id, { resend: true })
      onSuccess()
    } catch (e) {
      setError(e.response?.data?.error || 'Gagal menghantar semula e-mel.')
    } finally {
      setResending(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Sunting Rekod Eskalasi">
      <div className="space-y-4">
        {escalation.user && (
          <p className="text-sm text-gray-600">
            PIC: <span className="font-medium text-gray-900">{escalation.user.name}</span> ({escalation.user.email})
          </p>
        )}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Negeri</label>
          <input className="input" value={state} onChange={(e) => setState(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Status Respons</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {ESCALATION_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Teks Respons Rasmi Negeri</label>
          <textarea rows={4} className="input" value={responseText} onChange={(e) => setResponseText(e.target.value)} />
        </div>
        {escalation.user && (
          <button onClick={handleResend} disabled={resending} className="btn-secondary text-xs py-1.5">
            {resending ? 'Menghantar...' : '📧 Hantar Semula E-mel Eskalasi'}
          </button>
        )}
        {error && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-3">{error}</div>}
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Batal</button>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
            {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function DeleteEscalationModal({ caseId, escalation, onClose, onSuccess }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = async () => {
    setSubmitting(true); setError('')
    try {
      await deleteEscalation(caseId, escalation.id)
      onSuccess()
    } catch (e) {
      setError(e.response?.data?.error || 'Gagal memadam rekod.')
      setSubmitting(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Padam Rekod Eskalasi" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Padam rekod eskalasi untuk{' '}
          <span className="font-medium text-gray-900">{escalation.user?.name || `Negeri ${escalation.state}`}</span>?
          Tindakan ini tidak boleh dibatalkan.
        </p>
        {error && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-3">{error}</div>}
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Batal</button>
          <button onClick={handleDelete} disabled={submitting} className="btn-danger">
            {submitting ? 'Memadam...' : 'Padam'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function RespondEscalationModal({ caseId, onClose, onSuccess }) {
  const [responseText, setResponseText] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (responseText.trim().length < 5) return setError('Respons diperlukan (min 5 aksara).')
    setSubmitting(true); setError('')
    try {
      await respondToEscalation(caseId, responseText)
      onSuccess()
    } catch (e) {
      setError(e.response?.data?.error || 'Gagal menghantar respons.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Respons Rasmi Negeri Terhadap Syor">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Respons ini akan direkodkan sebagai maklum balas rasmi negeri terhadap syor tindakan (Agent C) bagi kes ini.
        </p>
        <textarea rows={5} className="input" placeholder="Nyatakan tindakan yang telah/akan diambil oleh negeri terhadap syor ini…"
          value={responseText} onChange={(e) => setResponseText(e.target.value)} />
        {error && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-3">{error}</div>}
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Batal</button>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
            {submitting ? 'Menghantar...' : 'Hantar Respons'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
