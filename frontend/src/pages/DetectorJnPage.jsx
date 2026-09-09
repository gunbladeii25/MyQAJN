import { useState } from 'react'
import { ExternalLink, ShieldCheck } from 'lucide-react'
import PageBanner from '../components/ui/PageBanner'
import { getDetectorJnSsoUrl } from '../services/api'

const DETECTOR_JN_URL = import.meta.env.VITE_DETECTOR_JN_URL || 'https://app.8.233.60.191.nip.io'

// Detector@JN ("Nazir Insight AI") ialah sistem berasingan (microservices
// FastAPI, VM GCP sendiri) — takde sesi/DB dikongsi dengan myqajn. Klik
// "Buka Detector@JN" minta URL SSO sekali-guna daripada backend myqajn
// (lihat auth.controller.js getDetectorJnSsoUrl), yang bawa terus ke
// dashboard Detector@JN tanpa skrin log masuk berasingan. Kalau backend
// gagal/token SSO belum dikonfigurasi, gugur balik ke pautan biasa
// (masih boleh diakses, cuma nampak skrin log masuk Google Detector@JN).
export default function DetectorJnPage() {
  const [loading, setLoading] = useState(false)

  const handleOpen = async () => {
    setLoading(true)
    // Buka tab kosong SEBELUM await — sebahagian pelayar sekat window.open()
    // yang dipanggil selepas kod async (bukan lagi dianggap tindakan
    // langsung pengguna), jadi tetingkap perlu dibuka segera lepas klik.
    const win = window.open('', '_blank')
    try {
      const res = await getDetectorJnSsoUrl()
      if (win) win.location.href = res.data.url
      else window.open(res.data.url, '_blank')
    } catch {
      if (win) win.location.href = DETECTOR_JN_URL
      else window.open(DETECTOR_JN_URL, '_blank')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageBanner
        title="Detector@JN"
        subtitle="Sistem AI pengesanan percanggahan data & sokongan temuduga Jemaah Nazir — dibuka dalam tab baharu."
      />

      <div className="card p-6 sm:p-8 max-w-xl">
        <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center mb-4">
          <ShieldCheck className="w-6 h-6 text-indigo-600" />
        </div>
        <h3 className="font-heading font-bold text-gray-900 mb-2">Akses Detector@JN</h3>
        <p className="text-sm text-gray-500 mb-6">
          Klik butang di bawah untuk ke dashboard Detector@JN — anda log masuk
          secara automatik dengan akaun MOE yang sama, tanpa skrin log masuk
          berasingan.
        </p>
        <button
          onClick={handleOpen}
          disabled={loading}
          className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 disabled:opacity-60"
        >
          {loading ? 'Membuka...' : 'Buka Detector@JN'}
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
