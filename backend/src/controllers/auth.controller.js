const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const { OAuth2Client } = require('google-auth-library')
const prisma = require('../utils/prisma')
const logger = require('../utils/logger')
const { sendMail } = require('../utils/mailer')
const { renderEmail } = require('../utils/emailTemplate')

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000 // 30 minit
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN })

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
const allowedGoogleDomains = (process.env.GOOGLE_ALLOWED_DOMAINS || 'moe.gov.my,moe-dl.edu.my')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean)

// Roles allowed to request a Detector@JN SSO handoff — mirrors the nav-link
// gating in Sidebar.jsx/App.jsx, checked again here server-side (defense in
// depth: the frontend gate is just UI, this is what actually issues tokens).
const DETECTOR_JN_SSO_ROLES = ['pegawai_nazir', 'admin']

const login = async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan kata laluan diperlukan.' })
  }

  try {
    // Padankan tanpa kira huruf besar/kecil — MySQL (utf8mb4_unicode_ci) buat
    // ini secara automatik, Postgres tidak, jadi normalisasi eksplisit di sini.
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Email atau kata laluan tidak betul.' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return res.status(401).json({ error: 'Email atau kata laluan tidak betul.' })
    }

    const token = signToken(user.id)

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        resourceType: 'auth',
        details: JSON.stringify({ email: user.email }),
      },
    })

    logger.info(`User login: ${user.email} (${user.role})`)

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        sector: user.sector,
        mustChangePassword: user.mustChangePassword,
      },
    })
  } catch (err) {
    logger.error(`Login error: ${err.message}`)
    return res.status(500).json({ error: 'Ralat server.' })
  }
}

// Google Sign-In — independent identity path alongside the email/password
// login above. Verifies the ID token with Google, then looks up an EXISTING
// active user by email (same pre-registration semantics as password login —
// a valid MOE-domain Google account alone does not grant access, an admin
// must have already created the account via UsersPage). Issues the same
// JWT shape as password login, so auth.middleware.js needs no changes.
const loginWithGoogle = async (req, res) => {
  const { idToken } = req.body
  if (!idToken) {
    return res.status(400).json({ error: 'Token Google diperlukan.' })
  }

  let payload
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID })
    payload = ticket.getPayload()
  } catch (err) {
    logger.error(`Google token verification failed: ${err.message}`)
    return res.status(401).json({ error: 'Token Google tidak sah.' })
  }

  if (!payload?.email_verified) {
    return res.status(401).json({ error: 'E-mel Google tidak disahkan.' })
  }

  const email = payload.email.trim().toLowerCase()
  const domain = email.split('@')[1]
  if (!allowedGoogleDomains.includes(domain)) {
    return res.status(403).json({ error: 'Domain e-mel akaun ini tidak dibenarkan.' })
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.isActive) {
      return res.status(403).json({ error: 'Akaun ini belum didaftarkan. Hubungi pentadbir untuk mendaftar.' })
    }

    const token = signToken(user.id)

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        resourceType: 'auth',
        details: JSON.stringify({ email: user.email, method: 'google' }),
      },
    })

    logger.info(`User login (Google): ${user.email} (${user.role})`)

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        sector: user.sector,
        mustChangePassword: user.mustChangePassword,
      },
    })
  } catch (err) {
    logger.error(`Google login error: ${err.message}`)
    return res.status(500).json({ error: 'Ralat server.' })
  }
}

// Detector@JN SSO handoff — mints a short-lived, purpose-scoped token so the
// already-authenticated myqajn user lands straight in Detector@JN's dashboard
// instead of seeing its own Google login screen. Deliberately signed with a
// SEPARATE secret (SSO_HANDOFF_SECRET, not JWT_SECRET) so a leak of it can
// only ever kick off this one handoff for one specific email — never forge a
// full myqajn or Detector@JN session directly. Detector@JN's own auth-service
// still re-checks that the email is pre-registered & active there; myqajn
// does not provision Detector@JN accounts.
const getDetectorJnSsoUrl = async (req, res) => {
  if (!DETECTOR_JN_SSO_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'Akses tidak dibenarkan.' })
  }
  if (!process.env.SSO_HANDOFF_SECRET || !process.env.DETECTOR_JN_URL) {
    return res.status(503).json({ error: 'SSO Detector@JN belum dikonfigurasi.' })
  }

  const handoffToken = jwt.sign(
    { email: req.user.email, purpose: 'detector-jn-sso' },
    process.env.SSO_HANDOFF_SECRET,
    { expiresIn: '60s' }
  )

  return res.json({ url: `${process.env.DETECTOR_JN_URL}/sso?token=${handoffToken}` })
}

const getMe = async (req, res) => {
  const { passwordHash, ...user } = req.user
  return res.json({ user })
}

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Kata laluan semasa dan baru diperlukan.' })
  }

  const valid = await bcrypt.compare(currentPassword, req.user.passwordHash)
  if (!valid) return res.status(400).json({ error: 'Kata laluan semasa tidak betul.' })

  const hash = await bcrypt.hash(newPassword, 12)
  // Clears mustChangePassword too — this is the only way that flag gets
  // turned off (set by createUser/resetPassword in users.controller.js
  // whenever an admin, not the user, chose the password).
  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash: hash, mustChangePassword: false } })

  return res.json({ message: 'Kata laluan berjaya dikemas kini.' })
}

// ── Lupa Kata Laluan (self-service, sah melalui e-mel) ───────────────────────
//
// forgotPassword: SENTIASA balas mesej generik yang sama sama ada e-mel wujud
// atau tidak — mengelakkan "user enumeration" (penyerang meneka e-mel sah
// dalam sistem berdasarkan respons berbeza).
const forgotPassword = async (req, res) => {
  const { email } = req.body
  const GENERIC_MSG = 'Jika e-mel tersebut wujud dalam sistem, pautan reset kata laluan telah dihantar.'
  if (!email) return res.status(400).json({ error: 'E-mel diperlukan.' })

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
  if (!user || !user.isActive) {
    logger.info(`Forgot-password diminta untuk e-mel tidak wujud/tidak aktif: ${email}`)
    return res.json({ message: GENERIC_MSG })
  }

  // Batalkan token lama yang belum digunakan supaya hanya SATU pautan aktif
  // pada satu masa bagi pengguna ini.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  })

  const rawToken = crypto.randomBytes(32).toString('hex')
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  })

  const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${rawToken}`
  try {
    await sendMail({
      to: user.email,
      subject: '🔐 Reset Kata Laluan — MyQA@JN',
      html: renderEmail({
        preheader: 'Klik pautan untuk menetapkan kata laluan baharu — sah selama 30 minit sahaja.',
        eyebrow: 'Keselamatan Akaun',
        heading: 'Permintaan Reset Kata Laluan',
        bodyHtml: `
          <p style="margin:0 0 14px;">Salam sejahtera <strong>${user.name}</strong>,</p>
          <p style="margin:0 0 14px;">
            Kami menerima permintaan untuk reset kata laluan akaun MyQA@JN anda
            (<strong>${user.email}</strong>). Klik butang di bawah untuk menetapkan
            kata laluan baharu.
          </p>
          <p style="margin:0;padding:10px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:13px;color:#92400e;">
            ⏱️ Pautan ini sah selama <strong>30 minit</strong> sahaja dan hanya boleh digunakan <strong>sekali</strong>.
          </p>
          <p style="margin:18px 0 0;font-size:13px;color:#64748b;">
            Jika anda tidak memohon reset ini, abaikan e-mel ini — kata laluan anda kekal selamat dan tidak berubah.
          </p>
        `,
        ctaText: 'Reset Kata Laluan',
        ctaUrl: resetLink,
      }),
    })
  } catch (err) {
    logger.error(`Gagal hantar e-mel reset kata laluan ke ${user.email}: ${err.message}`)
    // Tidak dedahkan kegagalan kepada pemohon — kekal balas mesej generik.
  }

  await prisma.auditLog.create({
    data: { userId: user.id, action: 'FORGOT_PASSWORD_REQUEST', resourceType: 'auth', details: JSON.stringify({ email: user.email }) },
  })

  return res.json({ message: GENERIC_MSG })
}

// verifyResetToken: semakan ringan (tanpa mendedahkan info) supaya UI boleh
// terus tunjuk mesej "pautan tamat tempoh" tanpa perlu pengguna isi borang dahulu.
const verifyResetToken = async (req, res) => {
  const { token } = req.params
  if (!token) return res.status(400).json({ valid: false })

  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } })
  const valid = !!record && !record.usedAt && record.expiresAt > new Date()
  return res.json({ valid })
}

const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token dan kata laluan baharu diperlukan.' })
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Kata laluan baharu mesti sekurang-kurangnya 8 aksara.' })
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  })
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return res.status(400).json({ error: 'Token tidak sah atau telah tamat tempoh. Sila mohon pautan reset baharu.' })
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Batalkan mana-mana token lain yang masih belum guna bagi pengguna ini.
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null, id: { not: record.id } },
      data: { usedAt: new Date() },
    }),
  ])

  await prisma.auditLog.create({
    data: { userId: record.userId, action: 'RESET_PASSWORD_SELF', resourceType: 'auth' },
  })

  logger.info(`Kata laluan direset sendiri oleh: ${record.user.email}`)

  // Amaran keselamatan — jika pengguna TIDAK memohon reset ini, e-mel ini
  // memberi amaran awal bahawa akaun mereka mungkin terjejas.
  try {
    await sendMail({
      to: record.user.email,
      subject: '✅ Kata Laluan Anda Telah Ditukar — MyQA@JN',
      html: renderEmail({
        preheader: 'Kata laluan akaun anda baru sahaja ditukar melalui fungsi Lupa Kata Laluan.',
        eyebrow: 'Makluman Keselamatan',
        heading: 'Kata Laluan Berjaya Ditukar',
        accentColor: '#16a34a',
        bodyHtml: `
          <p style="margin:0 0 14px;">Salam sejahtera <strong>${record.user.name}</strong>,</p>
          <p style="margin:0 0 14px;">
            Kata laluan akaun MyQA@JN anda (<strong>${record.user.email}</strong>) baru sahaja
            ditukar melalui fungsi "Lupa Kata Laluan" pada ${new Date().toLocaleString('ms-MY')}.
          </p>
          <p style="margin:0;padding:12px 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:13px;color:#b91c1c;font-weight:600;">
            ⚠️ Jika anda TIDAK membuat perubahan ini, akaun anda mungkin terjejas — hubungi Administrator Sistem dengan segera.
          </p>
        `,
      }),
    })
  } catch (err) {
    logger.error(`Gagal hantar e-mel pengesahan reset ke ${record.user.email}: ${err.message}`)
  }

  return res.json({ message: 'Kata laluan berjaya ditetapkan semula. Sila log masuk dengan kata laluan baharu.' })
}

module.exports = { login, loginWithGoogle, getDetectorJnSsoUrl, getMe, changePassword, forgotPassword, verifyResetToken, resetPassword }
