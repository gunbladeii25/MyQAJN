import { NavLink } from 'react-router-dom'
import { LayoutDashboard, FileText, Users, BookOpen, ShieldCheck, Database } from 'lucide-react'
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
    <aside className="w-64 bg-primary flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">MyQA@JN</p>
            <p className="text-white/60 text-xs">AI-Powered School QA Resolution Agent</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {/* Dashboard — no step */}
        {visible.filter(i => i.step === null && i.to !== '/users').map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all mb-2',
                isActive ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
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
              <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Aliran Kerja</p>
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
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-1 relative z-10',
                      isActive ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Step number badge */}
                      <div className={clsx(
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border',
                        isActive
                          ? 'bg-white text-primary border-white'
                          : 'bg-white/10 text-white/80 border-white/20'
                      )}>
                        {item.step}
                      </div>
                      <div className="min-w-0">
                        <p className="leading-tight truncate">{item.label}</p>
                        {item.hint && (
                          <p className={clsx('text-xs leading-tight mt-0.5 truncate', isActive ? 'text-white/70' : 'text-white/40')}>
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
              <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Pentadbiran</p>
            </div>
            {visible.filter(i => i.to === '/users').map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                    isActive ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
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
      <div className="p-4 border-t border-white/10">
        <p className="text-white text-sm font-medium truncate">{user?.name}</p>
        <p className="text-white/50 text-xs mt-0.5 truncate">{user?.email}</p>
      </div>
    </aside>
  )
}
