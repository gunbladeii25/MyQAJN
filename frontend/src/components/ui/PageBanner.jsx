// Soft-depth hero banner — reusable per-page, opt-in (not mounted globally in
// Layout.jsx) so dense pages (Cases, Case Detail, Data Ingestion) aren't
// forced to spend vertical space on it. Gentle indigo→sky gradient with a
// colored soft shadow, matching the Sidebar's floating-card language.
export default function PageBanner({ title, subtitle, ctaLabel, onCta }) {
  return (
    <div className="relative overflow-hidden rounded-[20px]
      bg-gradient-to-r from-indigo-600 via-primary-500 to-sky-400
      px-6 py-6 sm:px-7 sm:py-7 text-white"
      style={{ boxShadow: '0 10px 30px 0 rgba(79,70,229,0.25)' }}>

      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-heading font-bold text-lg leading-tight">{title}</h3>
          {subtitle && <p className="text-sm text-white/85 mt-1 max-w-lg">{subtitle}</p>}
        </div>
        {ctaLabel && onCta && (
          <button
            onClick={onCta}
            className="flex-shrink-0 bg-white text-indigo-600 rounded-xl px-4 py-2.5 text-sm font-bold
              hover:bg-white/90 transition-colors whitespace-nowrap"
            style={{ boxShadow: '0 4px 12px 0 rgba(0,0,0,0.12)' }}
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  )
}
