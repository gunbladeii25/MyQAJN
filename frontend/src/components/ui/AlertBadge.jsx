import { clsx } from 'clsx'
import { ALERT_COLORS, DI_LABELS } from '../../constants'

export function AlertBadge({ level, size = 'sm' }) {
  const c = ALERT_COLORS[level] || ALERT_COLORS.GREEN
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full font-medium border', c.bg, c.text, c.border,
      size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm')}>
      <span className={clsx('rounded-full flex-shrink-0', c.dot, size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2')} />
      {level}
    </span>
  )
}

export function DiClassBadge({ classification }) {
  const alertMap = {
    EXTREME_DISCREPANCY: 'RED', SEVERE_DISCREPANCY: 'ORANGE',
    MODERATE_DISCREPANCY: 'YELLOW', MINOR_DISCREPANCY: 'BLUE', DATA_ALIGNED: 'GREEN',
  }
  const level = alertMap[classification] || 'GREEN'
  const c = ALERT_COLORS[level]
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full font-medium border text-xs px-2.5 py-1', c.bg, c.text, c.border)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', c.dot)} />
      {DI_LABELS[classification] || classification}
    </span>
  )
}

export function StatusBadge({ status, colorMap }) {
  const cfg = colorMap?.[status] || { label: status, color: 'bg-gray-100 text-gray-600' }
  return (
    <span className={clsx('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium', cfg.color)}>
      {cfg.label}
    </span>
  )
}
