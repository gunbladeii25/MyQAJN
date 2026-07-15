import { LogOut, User, Globe, Loader2, Menu } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useLanguage } from '../../contexts/LanguageContext'
import { ROLES, SECTOR_NAMES } from '../../constants'

export default function Header({ onMenuClick }) {
  const { user, logout } = useAuthStore()
  const { lang, languages, setLanguage, translating } = useLanguage()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between flex-shrink-0 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="md:hidden flex-shrink-0 p-2 -ml-1 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h2 className="text-sm font-heading font-semibold text-gray-900 truncate">
            {user?.sector ? SECTOR_NAMES[user.sector] : 'Dashboard Sistem'}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {new Date().toLocaleDateString('ms-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Penukar bahasa — dropdown, skop untuk tambah bahasa akan datang
            (SUPPORTED_LANGUAGES di constants/index.js) */}
        {/* Dibataskan lebar pada mudah alih (native <select> akan cuba muat
            keseluruhan teks pilihan semasa dipilih, boleh tolak/tindih
            ikon hamburger jika tidak dihadkan) — teks penuh tetap
            kelihatan bila dropdown dibuka, hanya paparan tertutup dipotong. */}
        <div className="relative flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full border border-gray-200 bg-gray-50 select-none
          max-w-[76px] sm:max-w-none overflow-hidden"
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
            className="w-full text-xs font-semibold tracking-wide text-gray-700 bg-transparent border-none outline-none pr-5 py-0.5 cursor-pointer disabled:cursor-wait"
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
        <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-gray-100 max-w-[140px] sm:max-w-none">
          <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span className="text-xs font-medium text-gray-700 truncate">{user?.name}</span>
          {user?.role && (
            <span className={`hidden sm:inline text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${ROLES[user.role]?.color}`}>
              {ROLES[user.role]?.label}
            </span>
          )}
          {user?.sector && (
            <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 font-medium whitespace-nowrap">
              {user.sector}
            </span>
          )}
        </div>
        <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-danger-600 hover:bg-danger-50 rounded-md transition-colors" title="Log Keluar">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
