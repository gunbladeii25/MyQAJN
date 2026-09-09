import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, ClipboardCheck, ShieldCheck, FileCheck2, Building2 } from 'lucide-react'
import { login } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import { DEFAULT_ROUTE_BY_ROLE } from '../constants'
import AuthShell from '../components/ui/AuthShell'
import AuthDescriptionCarousel from '../components/ui/AuthDescriptionCarousel'
import loginImage1 from '../images/image1.jfif?url'
import loginImage2 from '../images/image2.jpg?url'
import loginImage3 from '../images/image3.jpg?url'

// Slaid penerangan sistem untuk panel kiri kad log masuk. Kandungan
// mencerminkan tujuan sebenar sistem, rujuk pipeline Agen A/B/C dan Indeks
// Perbezaan dalam ai-engine/, bukan sekadar tagline generik "pelaporan isu".
const LOGIN_SLIDES = [
  {
    Icon: ClipboardCheck,
    title: 'Kesan Percanggahan Data Sekolah',
    description: 'Bandingkan laporan atau dapatan Bahagian, JPN dan PPD (kualitatif atau kuantitatif) dengan dapatan sebenar Jemaah Nazir (SK@S / laporan pemeriksaan) untuk kesan percanggahan.',
    image: loginImage1,
  },
  {
    Icon: ShieldCheck,
    title: 'Analisis AI Tiga Peringkat',
    description: 'Agen AI mengklasifikasikan isu, mengira Indeks Perbezaan (DI), dan mengesan corak anomali supaya tahap amaran yang diberikan tepat mengikut keterukan kes.',
    image: loginImage2,
  },
  {
    Icon: FileCheck2,
    title: 'Draf Surat Arahan Rasmi',
    description: 'AI menjana draf surat arahan berpandukan Akta Pendidikan, SKPMG2 dan polisi KPM, namun tetap memerlukan tandatangan pegawai kanan sebelum diedar secara rasmi.',
    image: loginImage3,
  },
  {
    Icon: Building2,
    title: 'Eskalasi ke Penyelaras JPN Negeri',
    description: 'Kes berisiko tinggi terus dieskalasi kepada penyelaras JPN setiap negeri untuk respons rasmi, merangkumi lebih 10,000 sekolah di seluruh negara.',
    image: loginImage1,
  },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm()
  const [apiError, setApiError] = useState('')
  const [showPw, setShowPw] = useState(false)

  const onSubmit = async (data) => {
    setApiError('')
    try {
      const res = await login(data)
      setAuth(res.data.token, res.data.user)
      navigate(DEFAULT_ROUTE_BY_ROLE[res.data.user?.role] || '/dashboard')
    } catch (err) {
      setApiError(err.response?.data?.error || 'Ralat log masuk. Cuba sebentar lagi.')
    }
  }

  return (
    <AuthShell
      split
      aside={<AuthDescriptionCarousel slides={LOGIN_SLIDES} />}
      footer={
        <p className="text-center text-white/40 text-xs mt-6">
          © 2026 Kementerian Pendidikan · MyQA@JN
        </p>
      }
    >
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Log Masuk</h2>
      <p className="text-sm text-gray-500 mb-6 md:hidden">
        Log masuk untuk melaporkan isu kualiti sekolah, menjejak status penyelesaian, dan
        menerima cadangan tindakan berbantukan AI.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Alamat E-mel</label>
          <input
            type="email"
            className="input"
            placeholder="nama@moe.gov.my"
            {...register('email', { required: 'E-mel diperlukan' })}
          />
          {errors.email && <p className="text-danger-600 text-xs mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="label">Kata Laluan</label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              className="input pr-10"
              placeholder="••••••••"
              {...register('password', { required: 'Kata laluan diperlukan' })}
            />
            <button type="button" onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="text-right mt-1.5">
            <Link to="/forgot-password" className="text-xs text-primary-600 hover:underline">Lupa Kata Laluan?</Link>
          </div>
          {errors.password && <p className="text-danger-600 text-xs mt-1">{errors.password.message}</p>}
        </div>

        {apiError && (
          <div className="bg-danger-50 border border-danger-200 text-danger-700 text-sm rounded-md px-4 py-3">
            {apiError}
          </div>
        )}

        <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-2.5 mt-2">
          {isSubmitting ? 'Mengesahkan...' : 'Log Masuk'}
        </button>
      </form>
    </AuthShell>
  )
}
