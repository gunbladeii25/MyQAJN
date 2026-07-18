import { GraduationCap, ShieldCheck, FileCheck2, Building2, ClipboardCheck } from 'lucide-react'

// Motif ikon profesional (pendidikan/audit) melayang perlahan di latar —
// posisi/saiz/kelewatan berbeza untuk rasa organik, bukan berbaris kemas.
const FLOATING_ICONS = [
  { Icon: GraduationCap,   className: 'top-[12%] left-[10%] w-9 h-9',  delay: '0s',    rot: '-8deg' },
  { Icon: ShieldCheck,     className: 'top-[18%] right-[12%] w-7 h-7', delay: '1.2s',  rot: '6deg'  },
  { Icon: Building2,       className: 'bottom-[16%] left-[8%] w-8 h-8', delay: '2.4s', rot: '4deg'  },
  { Icon: FileCheck2,      className: 'bottom-[22%] right-[9%] w-8 h-8', delay: '0.6s', rot: '-5deg' },
  { Icon: ClipboardCheck,  className: 'top-[46%] right-[4%] w-6 h-6 hidden sm:block', delay: '3s', rot: '10deg' },
]

// Bekas kongsi untuk semua halaman pengesahan (log masuk, lupa kata laluan,
// reset kata laluan) — latar bergerak (blob + ikon melayang) + logo/kad
// dengan animasi masuk, supaya identiti visual & rasa "hidup" konsisten
// merentas ketiga-tiga halaman tanpa menduplikasi markup.
export default function AuthShell({ children, footer }) {
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 flex items-center justify-center p-4">

      {/* Ambient gradient blobs — pergerakan perlahan, buram */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-auth-blob absolute -top-24 -left-16 w-[28rem] h-[28rem] rounded-full bg-primary-400/25 blur-3xl" />
        <div className="animate-auth-blob absolute top-1/3 -right-24 w-[24rem] h-[24rem] rounded-full bg-warning-300/15 blur-3xl" style={{ animationDelay: '4s' }} />
        <div className="animate-auth-blob absolute -bottom-28 left-1/4 w-[26rem] h-[26rem] rounded-full bg-primary-300/20 blur-3xl" style={{ animationDelay: '8s' }} />
      </div>

      {/* Tekstur titik halus */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '28px 28px' }}
      />

      {/* Ikon melayang — motif pendidikan & audit */}
      <div className="pointer-events-none absolute inset-0 hidden md:block">
        {FLOATING_ICONS.map(({ Icon, className, delay, rot }, i) => (
          <div key={i} className={`animate-auth-float absolute text-white/20 ${className}`}
            style={{ animationDelay: delay, '--float-rot': rot }}>
            <Icon className="w-full h-full" strokeWidth={1.5} />
          </div>
        ))}
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8 animate-auth-fade-in">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="animate-auth-glow absolute inset-0 rounded-2xl bg-white/50 blur-xl" />
            <div className="relative w-16 h-16 rounded-2xl bg-white flex items-center justify-center p-2 shadow-lg">
              <img src="/logo-myqajn.png" alt="MyQA@JN" className="w-full h-full object-contain" />
            </div>
          </div>
          <h1 className="text-2xl font-heading font-bold text-white">MyQA@JN</h1>
          <p className="text-white/70 text-sm mt-1">AI-Powered School QA Resolution Agent</p>
          <p className="text-white/50 text-xs mt-1">Kementerian Pendidikan Malaysia</p>
        </div>

        {/* Hero card radius kept above the xl (14px) token as a deliberate
            brand exception — MYDS's scale tops out there, but this is a
            marketing-style hero card, not a content card. */}
        <div className="animate-auth-fade-up bg-white rounded-2xl shadow-menu p-8" style={{ animationDelay: '0.15s' }}>
          {children}
        </div>

        {footer}
      </div>
    </div>
  )
}
