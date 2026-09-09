import { NavLink } from 'react-router-dom'
import { LayoutDashboard, FileText, Users, BookOpen, Database, ShieldCheck } from 'lucide-react'
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
    to: '/detector-jn',
    icon: ShieldCheck,
    label: 'Detector@JN',
    step: null,
    roles: ['pegawai_nazir', 'admin'],
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
    // "Soft Depth" treatment: floating white cards with soft shadows on a
    // light blue-gray wash, rather than a dark glass panel.
    <aside
      className="hidden md:flex relative w-64 flex-col flex-shrink-0 overflow-y-auto
        bg-gradient-to-b from-[#EFF4FC] to-[#F6F8FC] shadow-[2px_0_16px_0_rgba(30,58,138,0.06)]"
    >

      {/* Logo */}
      <div className="p-5">
        <div className="flex items-center gap-3 bg-white rounded-2xl shadow-[0_2px_10px_0_rgba(30,58,138,0.08)] p-3.5">
          <div className="w-[34px] h-[34px] rounded-[11px] bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <img src="/logo-myqajn.png" alt="MyQA@JN" className="w-6 h-6 object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-800 font-heading font-bold text-[13.5px] leading-tight">MyQA@JN</p>
            <p className="text-slate-400 text-[10px]">AI-Powered School QA Resolution Agent</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 pb-2">
        {/* Dashboard — no step */}
        {visible.filter(i => i.step === null && i.to !== '/users').map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-[13px] font-semibold transition-all mb-2.5',
                isActive
                  ? 'bg-white text-slate-800 shadow-[0_2px_8px_0_rgba(30,58,138,0.06)]'
                  : 'text-slate-500 hover:bg-white/70'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={clsx('w-4 h-4 flex-shrink-0', isActive ? 'text-indigo-600' : 'text-slate-400')} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}

        {/* Workflow steps */}
        {stepItems.length > 0 && (
          <>
            <p className="px-3.5 pt-1 pb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Aliran Kerja</p>

            {/* Vertical step connector */}
            <div className="relative">
              {/* Connecting line behind steps */}
              {stepItems.length > 1 && (
                <div style={{
                  position: 'absolute',
                  left: 25,
                  top: 20,
                  bottom: 20,
                  width: 2,
                  background: '#DCE6F7',
                  borderRadius: 2,
                  zIndex: 0,
                }} />
              )}

              {stepItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-[12.5px] font-medium transition-all mb-1.5 relative z-10',
                      isActive
                        ? 'bg-white shadow-[0_2px_8px_0_rgba(30,58,138,0.06)]'
                        : 'hover:bg-white/70'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Step number badge */}
                      <div className={clsx(
                        'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0',
                        isActive
                          ? 'bg-gradient-to-br from-primary-500 to-indigo-600 text-white'
                          : 'bg-white border-2 border-[#DCE6F7] text-slate-400'
                      )}>
                        {item.step}
                      </div>
                      <item.icon className={clsx('w-4 h-4 flex-shrink-0', isActive ? 'text-indigo-600' : 'text-slate-400')} />
                      <div className="min-w-0">
                        <p className={clsx('leading-tight truncate', isActive ? 'text-slate-800 font-semibold' : 'text-slate-500')}>{item.label}</p>
                        {item.hint && (
                          <p className="text-[10px] leading-tight mt-0.5 truncate text-slate-400">
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
            <p className="px-3.5 pt-4 pb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Pentadbiran</p>
            {visible.filter(i => i.to === '/users').map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-[13px] font-semibold transition-all',
                    isActive
                      ? 'bg-white text-slate-800 shadow-[0_2px_8px_0_rgba(30,58,138,0.06)]'
                      : 'text-slate-500 hover:bg-white/70'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={clsx('w-4 h-4 flex-shrink-0', isActive ? 'text-indigo-600' : 'text-slate-400')} />
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User info */}
      <div className="m-4 mt-2 bg-white rounded-2xl shadow-[0_2px_8px_0_rgba(30,58,138,0.06)] p-3.5">
        <p className="text-slate-800 text-[12.5px] font-semibold truncate">{user?.name}</p>
        <p className="text-slate-400 text-[10.5px] mt-0.5 truncate">{user?.email}</p>
      </div>
    </aside>
  )
}
