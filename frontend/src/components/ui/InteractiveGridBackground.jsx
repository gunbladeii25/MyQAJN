import { useEffect, useRef } from 'react'

// Grid dekoratif interaktif untuk latar halaman pengesahan — garis grid malap
// yang "menyala" mengikut kedudukan tetikus (kesan sorotan/spotlight), sebagai
// gantian tekstur titik statik supaya latar terasa lebih hidup & moden.
// Dilukis pada <canvas> (bukan ratusan node DOM) supaya kekal murah walaupun
// redraw berlaku pada setiap mousemove.
const CELL = 40
const SPOTLIGHT_RADIUS = 260

export default function InteractiveGridBackground() {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let width = 0
    let height = 0
    const mouse = { x: -9999, y: -9999, active: false }

    const drawGrid = (alpha) => {
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let x = 0; x <= width; x += CELL) {
        ctx.moveTo(x + 0.5, 0)
        ctx.lineTo(x + 0.5, height)
      }
      for (let y = 0; y <= height; y += CELL) {
        ctx.moveTo(0, y + 0.5)
        ctx.lineTo(width, y + 0.5)
      }
      ctx.stroke()
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      drawGrid(0.06)

      if (mouse.active) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(mouse.x, mouse.y, SPOTLIGHT_RADIUS, 0, Math.PI * 2)
        ctx.clip()

        const glow = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, SPOTLIGHT_RADIUS)
        glow.addColorStop(0, 'rgba(255,255,255,0.10)')
        glow.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = glow
        ctx.fillRect(mouse.x - SPOTLIGHT_RADIUS, mouse.y - SPOTLIGHT_RADIUS, SPOTLIGHT_RADIUS * 2, SPOTLIGHT_RADIUS * 2)

        drawGrid(0.4)
        ctx.restore()
      }
    }

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      width = wrap.clientWidth
      height = wrap.clientHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw()
    }

    let ticking = false
    const scheduleDraw = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => { draw(); ticking = false })
    }

    const handleMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      mouse.x = x
      mouse.y = y
      mouse.active = x >= -SPOTLIGHT_RADIUS && x <= width + SPOTLIGHT_RADIUS &&
                      y >= -SPOTLIGHT_RADIUS && y <= height + SPOTLIGHT_RADIUS
      scheduleDraw()
    }
    const handleLeave = () => { mouse.active = false; scheduleDraw() }

    resize()
    window.addEventListener('resize', resize)
    // Sorotan ikut tetikus dipacu oleh input pengguna sendiri (bukan animasi
    // auto-main), jadi tidak dimatikan untuk prefers-reduced-motion — hanya
    // dilangkau terus jika pengguna memilih kurangkan pergerakan, grid statik
    // malap kekal kelihatan.
    if (!prefersReducedMotion) {
      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseleave', handleLeave)
    }

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseleave', handleLeave)
    }
  }, [])

  return (
    <div ref={wrapRef} className="pointer-events-none absolute inset-0">
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  )
}
