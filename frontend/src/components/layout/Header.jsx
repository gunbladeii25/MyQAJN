import { LogOut, User, Globe, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useLanguage } from '../../contexts/LanguageContext'
import { ROLES, SECTOR_NAMES } from '../../constants'

export default function Header() {
  const { user, logout } = useAuthStore()
  const { lang, languages, setLanguage, translating } = useLanguage()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">
          {user?.sector ? SECTOR_NAMES[user.sector] : 'Dashboard Sistem'}
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {new Date().toLocaleDateString('ms-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* Penukar bahasa — dropdown, skop untuk tambah bahasa akan datang
            (SUPPORTED_LANGUAGES di constants/index.js) */}
        <div className="relative flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full border border-gray-200 bg-gray-50 select-none"
          style={{ opacity: translating ? 0.7 : 1 }}>
          {translating
            ? <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin flex-shrink-0" />
            : <Globe className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          }
          <select
            value={lang}
            disabled={translating}
            onChange={(e) => setLanguage(e.target.value)}
            title="Tukar bahasa paparan"
            className="text-xs font-semibold tracking-wide text-gray-700 bg-transparent border-none outline-none pr-5 py-0.5 cursor-pointer disabled:cursor-wait"
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code}>{l.code} — {l.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100">
          <User className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-medium text-gray-700">{user?.name}</span>
          {user?.role && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLES[user.role]?.color}`}>
              {ROLES[user.role]?.label}
            </span>
          )}
          {user?.sector && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-medium">
              {user.sector}
            </span>
          )}
        </div>
        <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Log Keluar">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
