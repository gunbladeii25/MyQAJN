import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff } from 'lucide-react'
import { changePassword } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import { DEFAULT_ROUTE_BY_ROLE } from '../constants'
import AuthShell from '../components/ui/AuthShell'

// Reached right after login when the server flags mustChangePassword (see
// auth.middleware.js) — the password just used to log in was set by an
// admin (UsersPage.jsx create/reset), not chosen by this user, so it's
// treated as temporary and must be replaced before anything else works.
// No cancel/skip option, matching the server-side enforcement.
export default function ForcePasswordChangePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm()
  const [apiError, setApiError] = useState('')
  const [showPw, setShowPw] = useState(false)

  // Carried from LoginPage.jsx via router state so the user isn't asked to
  // retype the temp password they just entered. If it's missing (e.g. a
  // direct link, or a page refresh which clears router state), fall back
  // to asking for it — changePassword still needs it either way.
  const tempPassword = location.state?.tempPassword

  const onSubmit = async (data) => {
    setApiError('')
    try {
      await changePassword({
        currentPassword: tempPassword || data.currentPassword,
        newPassword: data.newPassword,
      })
      navigate(DEFAULT_ROUTE_BY_ROLE[user?.role] || '/dashboard', { replace: true })
    } catch (err) {
      setApiError(err.response?.data?.error || 'Ralat. Cuba sebentar lagi.')
    }
  }

  return (
    <AuthShell footer={
      <p className="text-center text-white/40 text-xs mt-6">
        © 2026 Kementerian Pendidikan · MyQA@JN
      </p>
    }>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Tetapkan Kata Laluan Baharu</h2>
      <p className="text-sm text-gray-500 mb-6">
        Kata laluan anda ditetapkan oleh pentadbir dan bersifat sementara.
        Sila tetapkan kata laluan baharu yang hanya diketahui oleh anda
        sebelum meneruskan.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {!tempPassword && (
          <div>
            <label className="label">Kata Laluan Sementara</label>
            <input
              type="password"
              className="input"
              placeholder="Kata laluan yang diberi oleh pentadbir"
              {...register('currentPassword', { required: 'Kata laluan sementara diperlukan' })}
            />
            {errors.currentPassword && <p className="text-danger-600 text-xs mt-1">{errors.currentPassword.message}</p>}
          </div>
        )}

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
          {errors.newPassword && <p className="text-danger-600 text-xs mt-1">{errors.newPassword.message}</p>}
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
          {errors.confirmPassword && <p className="text-danger-600 text-xs mt-1">{errors.confirmPassword.message}</p>}
        </div>

        {apiError && (
          <div className="bg-danger-50 border border-danger-200 text-danger-700 text-sm rounded-md px-4 py-3">
            {apiError}
          </div>
        )}

        <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-2.5 mt-2">
          {isSubmitting ? 'Menetapkan...' : 'Tetapkan Kata Laluan Baharu'}
        </button>
      </form>
    </AuthShell>
  )
}
