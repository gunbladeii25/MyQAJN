import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff } from 'lucide-react'
import { verifyResetToken, resetPasswordWithToken } from '../services/api'
import AuthShell from '../components/ui/AuthShell'

const STATUS = { checking: 'checking', valid: 'valid', invalid: 'invalid', done: 'done' }

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm()
  const [status, setStatus] = useState(STATUS.checking)
  const [apiError, setApiError] = useState('')
  const [showPw, setShowPw] = useState(false)

  // Semak kesahihan token DAHULU supaya pengguna tidak isi borang penuh
  // hanya untuk dapat tahu pautan sudah tamat tempoh selepas hantar.
  useEffect(() => {
    if (!token) { setStatus(STATUS.invalid); return }
    verifyResetToken(token)
      .then((r) => setStatus(r.data.valid ? STATUS.valid : STATUS.invalid))
      .catch(() => setStatus(STATUS.invalid))
  }, [token])

  const onSubmit = async (data) => {
    setApiError('')
    try {
      await resetPasswordWithToken(token, data.newPassword)
      setStatus(STATUS.done)
      setTimeout(() => navigate('/login'), 2500)
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
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Tetapkan Kata Laluan Baharu</h2>

      {status === STATUS.checking && (
        <p className="text-sm text-gray-500">Menyemak pautan...</p>
      )}

      {status === STATUS.invalid && (
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            Pautan reset tidak sah atau telah tamat tempoh (sah selama 30 minit sahaja). Sila mohon pautan baharu.
          </div>
          <Link to="/forgot-password" className="btn-primary w-full flex items-center justify-center py-2.5">
            Mohon Pautan Reset Baharu
          </Link>
        </div>
      )}

      {status === STATUS.done && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-4 py-3">
          Kata laluan berjaya ditetapkan semula. Mengalihkan ke Log Masuk...
        </div>
      )}

      {status === STATUS.valid && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Kata Laluan Baharu</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                className="input pr-10"
                placeholder="••••••••"
                {...register('newPassword', {
                  required: 'Kata laluan diperlukan',
                  minLength: { value: 8, message: 'Minimum 8 aksara' },
                })}
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.newPassword && <p className="text-red-500 text-xs mt-1">{errors.newPassword.message}</p>}
          </div>

          <div>
            <label className="label">Sahkan Kata Laluan Baharu</label>
            <input
              type={showPw ? 'text' : 'password'}
              className="input"
              placeholder="••••••••"
              {...register('confirmPassword', {
                required: 'Sahkan kata laluan diperlukan',
                validate: (v) => v === watch('newPassword') || 'Kata laluan tidak sepadan',
              })}
            />
            {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
          </div>

          {apiError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {apiError}
            </div>
          )}

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-2.5 mt-2">
            {isSubmitting ? 'Menetapkan...' : 'Tetapkan Kata Laluan Baharu'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
