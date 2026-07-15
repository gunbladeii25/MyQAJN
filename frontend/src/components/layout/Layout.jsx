import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import MyraChat from '../ui/MyraChat'
import { ToastProvider } from '../ui/Toast'
import { useRouteTranslation } from '../../contexts/LanguageContext'

export default function Layout() {
  useRouteTranslation() // re-apply translation on every route change

  return (
    <ToastProvider>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>
        <MyraChat />
      </div>
    </ToastProvider>
  )
}
