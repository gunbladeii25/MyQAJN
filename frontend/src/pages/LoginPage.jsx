import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff } from 'lucide-react'
import { login } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import { DEFAULT_ROUTE_BY_ROLE } from '../constants'
import AuthShell from '../components/ui/AuthShell'

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
    <AuthShell footer={
      <p className="text-center text-white/40 text-xs mt-6">
        © 2026 Kementerian Pendidikan Malaysia · MyQA@JN
      </p>
    }>
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Log Masuk</h2>

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
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">Lupa Kata Laluan?</Link>
          </div>
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>

        {apiError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
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
