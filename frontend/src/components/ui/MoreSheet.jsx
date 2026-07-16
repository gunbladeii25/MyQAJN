import { useNavigate } from 'react-router-dom'
import { Database, Users, Globe, LogOut, X, Loader2 } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useLanguage } from '../../contexts/LanguageContext'

// Destinations not already on the bottom tab bar (MobileTabBar.jsx), plus
// language switch + logout — everything the desktop Sidebar/Header expose
// that a 4-tab mobile bar has no room for.
const EXTRA_ITEMS = {
  admin:             [{ to: '/ingestion', icon: Database, label: 'Ingestion Data' }, { to: '/users', icon: Users, label: 'Pengurusan Pengguna' }],
  peneraju_sektor:   [{ to: '/ingestion', icon: Database, label: 'Ingestion Data' }],
  top_management:    [],
  penyelaras_jpn:    [],
  penganalisis_data: [],
}

export default function MoreSheet({ open, onClose }) {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { lang, languages, setLanguage, translating } = useLanguage()
  const items = EXTRA_ITEMS[user?.role] || []

  if (!open) return null

  const go = (to) => { navigate(to); onClose() }
  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="md:hidden fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-gray-900/40" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full bg-white rounded-t-2xl shadow-menu pb-8 pt-2 animate-auth-fade-up"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
      >
        <div className="w-9 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
        <div className="flex items-center justify-between px-5 mb-2">
          <p className="text-sm font-heading font-semibold text-gray-900">Lagi</p>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3">
          {items.map((item) => (
            <button
              key={item.to}
              onClick={() => go(item.to)}
              className="w-full flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-gray-50 text-left border-b border-gray-100"
            >
              <div className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
                <item.icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-gray-800">{item.label}</span>
            </button>
          ))}

          <div className="flex items-center gap-3 px-2 py-3 border-b border-gray-100">
            <div className="w-9 h-9 rounded-lg bg-warning-50 text-warning-600 flex items-center justify-center flex-shrink-0">
              {translating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
            </div>
            <select
              value={lang}
              disabled={translating}
              onChange={(e) => setLanguage(e.target.value)}
              className="text-sm font-medium text-gray-800 bg-transparent border-none outline-none flex-1"
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>{l.code} — {l.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-danger-50 text-left mt-1"
          >
            <div className="w-9 h-9 rounded-lg bg-danger-50 text-danger-600 flex items-center justify-center flex-shrink-0">
              <LogOut className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium text-danger-600">Log Keluar</span>
          </button>
        </div>
      </div>
    </div>
  )
}
