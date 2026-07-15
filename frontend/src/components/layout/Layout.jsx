import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import MyraChat from '../ui/MyraChat'
import { ToastProvider } from '../ui/Toast'
import { useRouteTranslation } from '../../contexts/LanguageContext'

export default function Layout() {
  useRouteTranslation() // re-apply translation on every route change

  // Sidebar is a fixed off-canvas drawer below the `md` breakpoint (opened
  // via Header's hamburger button) and a normal static flex item at `md`+ —
  // this state only ever matters on mobile, Sidebar ignores it on desktop.
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <ToastProvider>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-gray-900/50 md:hidden"
          />
        )}
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
        <MyraChat />
      </div>
    </ToastProvider>
  )
}
