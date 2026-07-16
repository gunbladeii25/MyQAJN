import { NavLink } from 'react-router-dom'
import { Home, FileText, BookOpen, Database, MoreHorizontal } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { clsx } from 'clsx'

// Primary destinations per role — capped at 3 so they fit a bottom tab bar
// alongside "Lagi". Anything not listed here (Ingestion Data, Pengurusan
// Pengguna for admin, language switch, logout) lives in MoreSheet instead.
// Mirrors the role scoping already in Sidebar.jsx's navItems, just reshaped
// for a max-4-tab bar rather than an unbounded vertical list.
const TAB_CONFIG = {
  admin:             [{ to: '/dashboard', icon: Home, label: 'Home' }, { to: '/cases', icon: FileText, label: 'Kes' }, { to: '/briefs', icon: BookOpen, label: 'Briefs' }],
  peneraju_sektor:   [{ to: '/dashboard', icon: Home, label: 'Home' }, { to: '/cases', icon: FileText, label: 'Kes' }, { to: '/briefs', icon: BookOpen, label: 'Briefs' }],
  top_management:    [{ to: '/dashboard', icon: Home, label: 'Home' }, { to: '/cases', icon: FileText, label: 'Kes' }, { to: '/briefs', icon: BookOpen, label: 'Briefs' }],
  penyelaras_jpn:    [{ to: '/cases', icon: FileText, label: 'Kes' }],
  penganalisis_data: [{ to: '/ingestion', icon: Database, label: 'Ingestion' }],
}

export default function MobileTabBar({ onMoreClick }) {
  const user = useAuthStore((s) => s.user)
  const tabs = TAB_CONFIG[user?.role] || []

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex items-stretch shadow-menu"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            clsx(
              'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-semibold relative',
              isActive ? 'text-primary-600' : 'text-gray-400'
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute top-0 w-7 h-[3px] rounded-full bg-primary-600" />}
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </>
          )}
        </NavLink>
      ))}
      <button
        onClick={onMoreClick}
        className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-semibold text-gray-400"
      >
        <MoreHorizontal className="w-5 h-5" />
        Lagi
      </button>
    </nav>
  )
}
