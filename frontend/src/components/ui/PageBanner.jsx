// Glass hero banner — reusable per-page, opt-in (not mounted globally in
// Layout.jsx) so dense pages (Cases, Case Detail, Data Ingestion) aren't
// forced to spend vertical space on it. Same gradient + blurred-blob glass
// treatment as the Sidebar, so the two read as one consistent surface.
export default function PageBanner({ title, subtitle, ctaLabel, onCta }) {
  return (
    <div className="relative overflow-hidden rounded-xl shadow-card
      bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900
      px-6 py-6 sm:px-7 sm:py-7 text-white">

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-16 -left-10 w-56 h-56 rounded-full bg-primary-400/35 blur-3xl" />
        <div className="absolute -bottom-20 right-4 w-56 h-56 rounded-full bg-warning-300/15 blur-3xl" />
      </div>

      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-heading font-bold text-lg leading-tight">{title}</h3>
          {subtitle && <p className="text-sm text-white/75 mt-1 max-w-lg">{subtitle}</p>}
        </div>
        {ctaLabel && onCta && (
          <button
            onClick={onCta}
            className="flex-shrink-0 bg-white text-primary-800 rounded-md px-4 py-2.5 text-sm font-semibold
              hover:bg-white/90 transition-colors whitespace-nowrap"
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  )
}
