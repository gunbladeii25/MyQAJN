import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import MobileTabBar from './MobileTabBar'
import MyraChat from '../ui/MyraChat'
import MoreSheet from '../ui/MoreSheet'
import { ToastProvider } from '../ui/Toast'
import { useRouteTranslation } from '../../contexts/LanguageContext'

export default function Layout() {
  useRouteTranslation() // re-apply translation on every route change

  // Mobile nav is a bottom tab bar + "Lagi" sheet (app-vibe redesign),
  // replacing the old hamburger/off-canvas-drawer approach entirely on
  // small screens. Sidebar reverts to a desktop-only static flex item.
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <ToastProvider>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 md:pb-6">
            <Outlet />
          </main>
        </div>
        <MyraChat />
        <MobileTabBar onMoreClick={() => setMoreOpen(true)} />
        <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
      </div>
    </ToastProvider>
  )
}
