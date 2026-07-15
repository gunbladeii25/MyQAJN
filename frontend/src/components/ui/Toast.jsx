import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { CheckCircle2, Info, X } from 'lucide-react'
import { clsx } from 'clsx'

const ToastContext = createContext(null)

const TONE = {
  success: { icon: CheckCircle2, classes: 'bg-success-50 border-success-200 text-success-700', iconClasses: 'text-success-600' },
  info:    { icon: Info,         classes: 'bg-primary-50 border-primary-200 text-primary-700',  iconClasses: 'text-primary-600' },
}

// Lightweight toast system — no toast library in this app yet, so this
// mirrors the hand-rolled ui/ primitives already used elsewhere (Modal,
// Tooltip, Spinner) rather than pulling in a new dependency.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const push = useCallback((message, tone) => {
    const id = ++nextId.current
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => dismiss(id), 6000)
  }, [dismiss])

  const toast = {
    success: (message) => push(message, 'success'),
    info: (message) => push(message, 'info'),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {toasts.map((t) => {
          const { icon: Icon, classes, iconClasses } = TONE[t.tone] || TONE.info
          return (
            <div
              key={t.id}
              className={clsx(
                'pointer-events-auto flex items-start gap-3 rounded-lg border shadow-menu px-4 py-3 animate-auth-fade-up',
                classes
              )}
            >
              <Icon className={clsx('w-5 h-5 flex-shrink-0 mt-0.5', iconClasses)} />
              <p className="text-sm leading-snug flex-1">{t.message}</p>
              <button onClick={() => dismiss(t.id)} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
                <X className="w-4 h-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
