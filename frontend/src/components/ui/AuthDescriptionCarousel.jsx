import { useEffect, useState } from 'react'

const AUTO_MS = 5000

// Panel kiri kad log masuk — penerangan ringkas sistem, satu slaid pada satu
// masa. Auto-swipe (kiri/kanan) bila lebih daripada satu slaid; noktah di
// bawah membenarkan pengguna lompat terus ke slaid tertentu.
export default function AuthDescriptionCarousel({ slides }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (slides.length <= 1) return undefined
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return undefined
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), AUTO_MS)
    return () => clearInterval(id)
  }, [slides.length])

  return (
    <div className="relative h-full flex flex-col justify-center">
      <div className="relative min-h-[240px]">
        {slides.map(({ Icon, title, description }, i) => (
          <div
            key={title}
            aria-hidden={i !== index}
            className={`absolute inset-0 flex flex-col items-start transition-all duration-700 ease-out
              ${i === index ? 'opacity-100 translate-x-0' : i < index ? 'opacity-0 -translate-x-6 pointer-events-none' : 'opacity-0 translate-x-6 pointer-events-none'}`}
          >
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mb-5">
              <Icon className="w-7 h-7 text-white" strokeWidth={1.75} />
            </div>
            <h3 className="text-xl font-heading font-semibold text-white mb-2">{title}</h3>
            <p className="text-white/70 text-sm leading-relaxed">{description}</p>
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <div className="flex items-center gap-2 mt-8">
          {slides.map((slide, i) => (
            <button
              key={slide.title}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Slaid ${i + 1}: ${slide.title}`}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/30 hover:bg-white/50'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
