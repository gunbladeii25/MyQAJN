import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Component } from 'react'
import { useAuthStore } from './stores/authStore'
import { LanguageProvider } from './contexts/LanguageContext'
import { DEFAULT_ROUTE_BY_ROLE } from './constants'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 32, fontFamily: 'monospace', background: '#fff1f2', minHeight: '100vh' }}>
        <h2 style={{ color: '#dc2626' }}>App Error</h2>
        <pre style={{ whiteSpace: 'pre-wrap', color: '#7f1d1d', fontSize: 13 }}>{String(this.state.error)}{'\n'}{this.state.error?.stack}</pre>
        <button onClick={() => this.setState({ error: null })} style={{ marginTop: 16, padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Retry</button>
      </div>
    )
    return this.props.children
  }
}
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import DashboardPage from './pages/DashboardPage'
import CasesPage from './pages/CasesPage'
import CaseDetailPage from './pages/CaseDetailPage'
import SubmitCasePage from './pages/SubmitCasePage'
import UsersPage from './pages/UsersPage'
import BriefsPage from './pages/BriefsPage'
import DataIngestionPage from './pages/DataIngestionPage'

function ProtectedRoute({ children, allowedRoles }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={DEFAULT_ROUTE_BY_ROLE[user.role] || '/dashboard'} replace />
  }
  return children
}

// Halaman utama selepas log masuk / laluan lalai — mengikut peranan, supaya
// setiap peranan mendarat di laman yang sepadan dengan sidebar mereka
// (cth. Penyelaras JPN tiada akses Dashboard, jadi lalai ke /cases).
function DefaultRedirect() {
  const user = useAuthStore((s) => s.user)
  return <Navigate to={DEFAULT_ROUTE_BY_ROLE[user?.role] || '/dashboard'} replace />
}

export default function App() {
  return (
    <ErrorBoundary>
    <LanguageProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<DefaultRedirect />} />
          <Route path="dashboard" element={
            <ProtectedRoute allowedRoles={['admin', 'peneraju_sektor', 'top_management']}>
              <DashboardPage />
            </ProtectedRoute>
          } />
          <Route path="cases" element={
            <ProtectedRoute allowedRoles={['admin', 'peneraju_sektor', 'top_management', 'penyelaras_jpn']}>
              <CasesPage />
            </ProtectedRoute>
          } />
          <Route path="cases/new" element={
            <ProtectedRoute allowedRoles={['admin', 'peneraju_sektor']}>
              <SubmitCasePage />
            </ProtectedRoute>
          } />
          <Route path="cases/:id" element={
            <ProtectedRoute allowedRoles={['admin', 'peneraju_sektor', 'top_management', 'penyelaras_jpn']}>
              <CaseDetailPage />
            </ProtectedRoute>
          } />
          <Route path="briefs" element={
            <ProtectedRoute allowedRoles={['admin', 'peneraju_sektor', 'top_management']}>
              <BriefsPage />
            </ProtectedRoute>
          } />
          <Route path="ingestion" element={
            <ProtectedRoute allowedRoles={['admin', 'peneraju_sektor', 'penganalisis_data']}>
              <DataIngestionPage />
            </ProtectedRoute>
          } />
          <Route path="users" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <UsersPage />
            </ProtectedRoute>
          } />
        </Route>
        <Route path="*" element={<DefaultRedirect />} />
      </Routes>
    </BrowserRouter>
    </LanguageProvider>
    </ErrorBoundary>
  )
}
