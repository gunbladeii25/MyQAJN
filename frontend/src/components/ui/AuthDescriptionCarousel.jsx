import { useEffect, useState } from 'react'

const AUTO_MS = 5000

// Panel kiri kad log masuk — penerangan ringkas sistem, satu slaid pada satu
// masa, dengan foto latar (opacity + gradient overlay supaya teks putih kekal
// mudah dibaca tidak kira kecerahan foto). Auto-swipe (kiri/kanan) bila lebih
// daripada satu slaid; noktah di bawah membenarkan pengguna lompat terus ke
// slaid tertentu.
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
    <div className="relative h-full w-full min-h-[420px]">
      {slides.map(({ Icon, title, description, image }, i) => (
        <div
          key={title}
          aria-hidden={i !== index}
          className={`absolute inset-0 transition-all duration-700 ease-out
            ${i === index ? 'opacity-100 translate-x-0' : i < index ? 'opacity-0 -translate-x-6 pointer-events-none' : 'opacity-0 translate-x-6 pointer-events-none'}`}
        >
          {image && (
            <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
          {/* Gradient overlay — jenamakan foto dengan warna primary & pastikan
              kontras teks putih mencukupi tidak kira kecerahan/komposisi foto. */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary-900/92 via-primary-800/85 to-primary-700/75" />

          <div className="relative z-10 h-full flex flex-col justify-center p-10">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center mb-5">
              <Icon className="w-7 h-7 text-white" strokeWidth={1.75} />
            </div>
            <h3 className="text-xl font-heading font-semibold text-white mb-2">{title}</h3>
            <p className="text-white/80 text-sm leading-relaxed">{description}</p>
          </div>
        </div>
      ))}

      {slides.length > 1 && (
        <div className="absolute z-10 bottom-8 left-10 flex items-center gap-2">
          {slides.map((slide, i) => (
            <button
              key={slide.title}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Slaid ${i + 1}: ${slide.title}`}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
