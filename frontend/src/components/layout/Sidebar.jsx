import { NavLink } from 'react-router-dom'
import { LayoutDashboard, FileText, Users, BookOpen, Database } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { clsx } from 'clsx'

// step: nombor langkah workflow (null = no step label)
const navItems = [
  {
    to: '/dashboard',
    icon: LayoutDashboard,
    label: 'Dashboard',
    step: null,
    roles: ['admin', 'peneraju_sektor', 'top_management'],
  },
  {
    to: '/ingestion',
    icon: Database,
    label: 'Ingestion Data',
    step: 1,
    hint: 'Kemaskini JN & tarik data luar',
    roles: ['admin', 'peneraju_sektor', 'penganalisis_data'],
  },
  {
    to: '/cases',
    icon: FileText,
    label: 'Pengurusan Kes',
    step: 2,
    hint: 'Semak & urus kes DI',
    roles: ['admin', 'peneraju_sektor', 'top_management'],
  },
  {
    to: '/cases',
    icon: FileText,
    label: 'Kes Dieskalasi',
    step: null,
    hint: 'Respons syor bagi negeri anda',
    roles: ['penyelaras_jpn'],
  },
  {
    to: '/briefs',
    icon: BookOpen,
    label: 'Executive Briefs',
    step: 3,
    hint: 'Surat arahan & laporan',
    roles: ['admin', 'peneraju_sektor', 'top_management'],
  },
  {
    to: '/users',
    icon: Users,
    label: 'Pengurusan Pengguna',
    step: null,
    roles: ['admin'],
  },
]

export default function Sidebar() {
  const user = useAuthStore((s) => s.user)

  const visible = navItems.filter((item) => item.roles.includes(user?.role))
  // Workflow steps visible to this user
  const stepItems = visible.filter((i) => i.step !== null)

  return (
    // Desktop-only chrome — mobile nav is the bottom tab bar + "Lagi" sheet
    // (MobileTabBar.jsx / MoreSheet.jsx), not a collapsed version of this.
    <aside
      className="hidden md:flex relative w-64 flex-col flex-shrink-0 overflow-hidden
        bg-gradient-to-b from-primary-700/90 via-primary-800/85 to-primary-900/90
        backdrop-blur-xl border-r border-white/10 shadow-2xl"
    >

      {/* Ambient blurred colour blobs — behind the nav, give the
          translucent/backdrop-blur "glass" surface something soft to
          diffuse instead of sitting flat over a plain colour. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-16 -left-10 w-56 h-56 rounded-full bg-primary-400/30 blur-3xl" />
        <div className="absolute top-1/2 -right-16 w-64 h-64 rounded-full bg-primary-300/15 blur-3xl" />
        <div className="absolute -bottom-20 left-1/4 w-56 h-56 rounded-full bg-primary-500/25 blur-3xl" />
      </div>

      {/* Logo */}
      <div className="relative z-10 p-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-white flex items-center justify-center p-1 shadow-button flex-shrink-0">
            <img src="/KPMJN-Hitam.png" alt="Jata KPM Jemaah Nazir" className="w-full h-full object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-heading font-semibold text-sm leading-tight">MyQA@JN</p>
            <p className="text-white/55 text-xs">AI-Powered School QA Resolution Agent</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex-1 p-3 space-y-0.5 overflow-y-auto">
        {/* Dashboard — no step */}
        {visible.filter(i => i.step === null && i.to !== '/users').map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all mb-2',
                isActive ? 'bg-white/15 text-white shadow-button' : 'text-white/65 hover:bg-white/10 hover:text-white'
              )
            }
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {item.label}
          </NavLink>
        ))}

        {/* Workflow steps */}
        {stepItems.length > 0 && (
          <>
            <div className="px-3 pt-1 pb-2">
              <p className="text-white/35 text-xs font-semibold uppercase tracking-widest">Aliran Kerja</p>
            </div>

            {/* Vertical step connector */}
            <div className="relative">
              {/* Connecting line behind steps */}
              {stepItems.length > 1 && (
                <div style={{
                  position: 'absolute',
                  left: 22,
                  top: 20,
                  bottom: 20,
                  width: 1,
                  background: 'rgba(255,255,255,0.15)',
                  zIndex: 0,
                }} />
              )}

              {stepItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all mb-1 relative z-10',
                      isActive ? 'bg-white/15 text-white shadow-button' : 'text-white/65 hover:bg-white/10 hover:text-white'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Step number badge */}
                      <div className={clsx(
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border',
                        isActive
                          ? 'bg-white text-primary-700 border-white'
                          : 'bg-white/10 text-white/75 border-white/20'
                      )}>
                        {item.step}
                      </div>
                      <item.icon className="w-4 h-4 flex-shrink-0 opacity-80" />
                      <div className="min-w-0">
                        <p className="leading-tight truncate">{item.label}</p>
                        {item.hint && (
                          <p className={clsx('text-xs leading-tight mt-0.5 truncate', isActive ? 'text-white/70' : 'text-white/35')}>
                            {item.hint}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </>
        )}

        {/* Admin-only items */}
        {visible.filter(i => i.to === '/users').length > 0 && (
          <>
            <div className="px-3 pt-3 pb-1">
              <p className="text-white/35 text-xs font-semibold uppercase tracking-widest">Pentadbiran</p>
            </div>
            {visible.filter(i => i.to === '/users').map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all',
                    isActive ? 'bg-white/15 text-white shadow-button' : 'text-white/65 hover:bg-white/10 hover:text-white'
                  )
                }
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User info */}
      <div className="relative z-10 p-4 border-t border-white/10">
        <p className="text-white text-sm font-medium truncate">{user?.name}</p>
        <p className="text-white/45 text-xs mt-0.5 truncate">{user?.email}</p>
      </div>
    </aside>
  )
}
