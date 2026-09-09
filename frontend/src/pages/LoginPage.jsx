import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, ClipboardCheck, ShieldCheck, FileCheck2, Building2 } from 'lucide-react'
import { login, loginWithGoogle } from '../services/api'
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
    description: 'Agen AI mengklasifikasikan isu, mengira Indeks Perbezaan (DI), dan mengesan corak anomali supaya tahap amaran yang diberikan tepat mengikut tahap risiko kes.',
    image: loginImage2,
  },
  {
    Icon: FileCheck2,
    title: 'Draf Surat Arahan Rasmi',
    description: 'AI menjana draf surat arahan berpandukan Akta Pendidikan, SK@S dan polisi KPM, namun tetap memerlukan tandatangan pegawai kanan sebelum diedar secara rasmi.',
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
  const googleButtonRef = useRef(null)

  const onSubmit = async (data) => {
    setApiError('')
    try {
      const res = await login(data)
      setAuth(res.data.token, res.data.user)
      if (res.data.user?.mustChangePassword) {
        // Carries the just-typed (admin-set, temporary) password forward so
        // ForcePasswordChangePage.jsx doesn't need to ask for it again.
        navigate('/force-password', { state: { tempPassword: data.password } })
        return
      }
      navigate(DEFAULT_ROUTE_BY_ROLE[res.data.user?.role] || '/dashboard')
    } catch (err) {
      setApiError(err.response?.data?.error || 'Ralat log masuk. Cuba sebentar lagi.')
    }
  }

  const onGoogleCredential = async (response) => {
    setApiError('')
    try {
      const res = await loginWithGoogle(response.credential)
      setAuth(res.data.token, res.data.user)
      if (res.data.user?.mustChangePassword) {
        navigate('/force-password')
        return
      }
      navigate(DEFAULT_ROUTE_BY_ROLE[res.data.user?.role] || '/dashboard')
    } catch (err) {
      setApiError(err.response?.data?.error || 'Log masuk Google gagal. Cuba sebentar lagi.')
    }
  }

  // Google Identity Services' script tag (index.html) loads `async defer`,
  // so `window.google` is frequently not ready yet on first mount here —
  // poll briefly instead of silently giving up on the first check.
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return

    let cancelled = false

    const renderGoogleButton = () => {
      if (cancelled || !window.google || !googleButtonRef.current) return
      window.google.accounts.id.initialize({ client_id: clientId, callback: onGoogleCredential })
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline', size: 'large', shape: 'pill', width: 320,
      })
    }

    if (window.google) {
      renderGoogleButton()
    } else {
      const intervalId = setInterval(() => {
        if (window.google) {
          clearInterval(intervalId)
          renderGoogleButton()
        }
      }, 100)
      const timeoutId = setTimeout(() => clearInterval(intervalId), 10000)
      return () => {
        cancelled = true
        clearInterval(intervalId)
        clearTimeout(timeoutId)
      }
    }
  }, [])

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

      {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
        <>
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">atau</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <div ref={googleButtonRef} className="flex justify-center" />
        </>
      )}
    </AuthShell>
  )
}
