import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { ArrowLeft } from 'lucide-react'
import { forgotPassword } from '../services/api'
import AuthShell from '../components/ui/AuthShell'

export default function ForgotPasswordPage() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm()
  const [sent, setSent] = useState(false)
  const [apiError, setApiError] = useState('')

  const onSubmit = async (data) => {
    setApiError('')
    try {
      await forgotPassword(data.email)
      // Backend sentiasa balas mesej generik yang sama sama ada e-mel wujud
      // atau tidak (elak "user enumeration") — jadi UI tunjuk mesej berjaya
      // tanpa mendedahkan sama ada akaun sebenarnya wujud.
      setSent(true)
    } catch (err) {
      setApiError(err.response?.data?.error || 'Ralat. Cuba sebentar lagi.')
    }
  }

  return (
    <AuthShell footer={
      <p className="text-center text-white/40 text-xs mt-6">
        © 2026 Kementerian Pendidikan Malaysia · MyQA@JN
      </p>
    }>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Lupa Kata Laluan</h2>

      {sent ? (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-4 py-3">
            Jika e-mel tersebut wujud dalam sistem, pautan reset kata laluan telah dihantar.
            Sila semak peti masuk anda (dan folder spam) — pautan sah selama 30 minit.
          </div>
          <Link to="/login" className="flex items-center justify-center gap-1.5 text-sm text-primary hover:underline">
            <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Log Masuk
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-6">
            Masukkan alamat e-mel akaun anda. Kami akan hantar pautan untuk menetapkan kata laluan baharu.
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
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            {apiError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {apiError}
              </div>
            )}

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-2.5 mt-2">
              {isSubmitting ? 'Menghantar...' : 'Hantar Pautan Reset'}
            </button>

            <Link to="/login" className="flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-primary mt-2">
              <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Log Masuk
            </Link>
          </form>
        </>
      )}
    </AuthShell>
  )
}
