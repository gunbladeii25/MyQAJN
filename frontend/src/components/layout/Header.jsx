import { LogOut, User, Globe, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useLanguage } from '../../contexts/LanguageContext'
import { ROLES, SECTOR_NAMES } from '../../constants'

// On mobile this whole bar simplifies to just the page title — language
// switch, user/role info, and logout all move into MoreSheet ("Lagi") since
// mobile nav is a bottom tab bar now, not this header (see Layout.jsx).
export default function Header() {
  const { user, logout } = useAuthStore()
  const { lang, languages, setLanguage, translating } = useLanguage()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="px-4 sm:px-6 py-3 flex items-center justify-between flex-shrink-0 gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-heading font-semibold text-slate-800 truncate">
          {user?.sector ? SECTOR_NAMES[user.sector] : 'Dashboard Sistem'}
        </h2>
        <p className="text-xs text-slate-400 mt-0.5 truncate">
          {new Date().toLocaleDateString('ms-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="hidden md:flex items-center gap-3 flex-shrink-0">
        {/* Penukar bahasa — dropdown, skop untuk tambah bahasa akan datang
            (SUPPORTED_LANGUAGES di constants/index.js) */}
        <div className="relative flex items-center gap-1.5 pl-2.5 pr-1 py-1.5 rounded-full bg-white shadow-[0_2px_6px_0_rgba(30,58,138,0.06)] select-none"
          style={{ opacity: translating ? 0.7 : 1 }}>
          {translating
            ? <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin flex-shrink-0" />
            : <Globe className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          }
          <select
            value={lang}
            disabled={translating}
            onChange={(e) => setLanguage(e.target.value)}
            title="Tukar bahasa paparan"
            className="w-full text-xs font-semibold tracking-wide text-slate-600 bg-transparent border-none outline-none pr-5 py-0.5 cursor-pointer disabled:cursor-wait"
            style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code}>{l.code} — {l.label}</option>
            ))}
          </select>
        </div>

        {/* Nama + peranan — pada skrin kecil hanya ikon + nama dipaparkan
            (badge peranan/sektor disembunyikan) supaya baris ini tidak
            melimpah/paksa skrol pada telefon. */}
        <div className="flex items-center gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-full bg-white shadow-[0_2px_6px_0_rgba(30,58,138,0.06)] max-w-[140px] sm:max-w-none">
          <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span className="text-xs font-medium text-slate-600 truncate">{user?.name}</span>
          {user?.role && (
            <span className={`hidden sm:inline text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${ROLES[user.role]?.color}`}>
              {ROLES[user.role]?.label}
            </span>
          )}
          {user?.sector && (
            <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium whitespace-nowrap">
              {user.sector}
            </span>
          )}
        </div>
        <button onClick={handleLogout} className="w-9 h-9 flex items-center justify-center bg-white shadow-[0_2px_6px_0_rgba(30,58,138,0.06)] text-slate-400 hover:text-danger-600 rounded-full transition-colors" title="Log Keluar">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
