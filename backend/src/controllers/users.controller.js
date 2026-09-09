const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const axios = require('axios')
const prisma = require('../utils/prisma')
const logger = require('../utils/logger')

// Keselamatan: hanya e-mel domain rasmi KPM dibenarkan berdaftar dalam sistem
// — mengelakkan akaun domain luar (outsource) daripada didaftarkan.
// @moe-dl.edu.my turut dibenarkan kerana ia domain rasmi KPM untuk
// pembelajaran digital (sama seperti Google SSO — lihat GOOGLE_ALLOWED_DOMAINS
// dalam auth.controller.js).
const ALLOWED_EMAIL_DOMAINS = ['@moe.gov.my', '@moe-dl.edu.my']
const isAllowedEmail = (email) => {
  const lower = email.toLowerCase()
  return ALLOWED_EMAIL_DOMAINS.some((domain) => lower.endsWith(domain))
}
const ALLOWED_EMAIL_DOMAINS_LABEL = ALLOWED_EMAIL_DOMAINS.join(' / ')

// Auto-provisions a Detector@JN account for a newly-created pegawai_nazir
// user, so an admin doesn't have to separately register the same person in
// both systems. Signed with its OWN secret (PROVISION_SECRET) — deliberately
// NOT the SSO_HANDOFF_SECRET used elsewhere (auth.controller.js), since this
// capability is materially bigger (creates an arbitrary account with a
// role) — see provision_secret's docstring in Detector@JN's core/config.py.
// Never throws: Detector@JN being unreachable/misconfigured must not block
// or roll back the myqajn user that was just created — the caller surfaces
// the returned warning string (if any) instead.
const provisionDetectorJnUser = async (email) => {
  if (!process.env.PROVISION_SECRET || !process.env.DETECTOR_JN_API_URL) {
    logger.info(`Detector@JN provisioning skipped for ${email}: belum dikonfigurasi.`)
    return 'Provisioning Detector@JN belum dikonfigurasi — daftar akaun ini secara manual di sana.'
  }

  const provisionToken = jwt.sign(
    { email, role: 'nazir', purpose: 'myqajn-provision' },
    process.env.PROVISION_SECRET,
    { expiresIn: '60s' }
  )

  try {
    await axios.post(`${process.env.DETECTOR_JN_API_URL}/users/provision`, { provisionToken }, { timeout: 10000 })
    return null
  } catch (err) {
    logger.error(`Detector@JN provisioning gagal untuk ${email}: ${err.message}`)
    return 'Pengguna dicipta di myqajn, tetapi provisioning automatik Detector@JN gagal — daftar akaun ini secara manual di sana jika perlu.'
  }
}

const listUsers = async (req, res) => {
  const { role, sector, isActive, search, page = 1, limit = 20 } = req.query
  const skip = (parseInt(page) - 1) * parseInt(limit)

  const where = {}
  if (role) where.role = role
  if (sector) where.sector = sector
  if (isActive !== undefined) where.isActive = isActive === 'true'
  if (search) where.OR = [
    { name: { contains: search } },
    { email: { contains: search } },
  ]

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, role: true, sector: true, state: true, isActive: true, createdAt: true },
    }),
    prisma.user.count({ where }),
  ])

  return res.json({ users, total, page: parseInt(page), limit: parseInt(limit) })
}

const getUser = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, name: true, email: true, role: true, sector: true, state: true, isActive: true, createdAt: true, updatedAt: true },
  })
  if (!user) return res.status(404).json({ error: 'Pengguna tidak dijumpai.' })
  return res.json({ user })
}

const createUser = async (req, res) => {
  const { name, password, role, sector, state } = req.body
  // Normalisasi e-mel — pastikan carian keunikan/log masuk konsisten tanpa
  // bergantung pada collation case-insensitive DB (MySQL ada, Postgres tiada).
  const email = req.body.email?.trim().toLowerCase()

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Nama, email, kata laluan, dan peranan diperlukan.' })
  }
  if (!isAllowedEmail(email)) {
    return res.status(400).json({ error: `Hanya e-mel domain ${ALLOWED_EMAIL_DOMAINS_LABEL} dibenarkan berdaftar dalam sistem.` })
  }
  if (role === 'peneraju_sektor' && !sector) {
    return res.status(400).json({ error: 'Sektor diperlukan untuk peranan Peneraju Sektor.' })
  }
  if (role === 'penyelaras_jpn' && !state) {
    return res.status(400).json({ error: 'Negeri diperlukan untuk peranan Penyelaras JPN.' })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return res.status(409).json({ error: 'Email telah digunakan.' })

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    // mustChangePassword: true — this password was chosen by the admin, not
    // the account's owner, so it's treated as temporary (see login/
    // authenticate middleware for the forced-change enforcement).
    data: { name, email, passwordHash, role, sector: sector || null, state: state || null, mustChangePassword: true },
    select: { id: true, name: true, email: true, role: true, sector: true, state: true, isActive: true, createdAt: true },
  })

  await prisma.auditLog.create({
    data: { userId: req.user.id, action: 'CREATE', resourceType: 'users', resourceId: user.id, details: JSON.stringify({ name, email, role }) },
  })

  logger.info(`User created: ${email} by ${req.user.email}`)

  // Auto-provision Detector@JN only for the role that actually uses it —
  // never blocks/rolls back the myqajn user above (see helper's docstring).
  const detectorJnProvisionWarning = role === 'pegawai_nazir' ? await provisionDetectorJnUser(email) : null

  return res.status(201).json({ user, detectorJnProvisionWarning })
}

const updateUser = async (req, res) => {
  const { name, role, sector, state, isActive } = req.body
  const email = req.body.email ? req.body.email.trim().toLowerCase() : undefined
  const { id } = req.params

  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Pengguna tidak dijumpai.' })
  if (role === 'peneraju_sektor' && !sector) {
    return res.status(400).json({ error: 'Sektor diperlukan untuk peranan Peneraju Sektor.' })
  }
  if (role === 'penyelaras_jpn' && !state) {
    return res.status(400).json({ error: 'Negeri diperlukan untuk peranan Penyelaras JPN.' })
  }
  if (email && email !== existing.email) {
    if (!isAllowedEmail(email)) {
      return res.status(400).json({ error: `Hanya e-mel domain ${ALLOWED_EMAIL_DOMAINS_LABEL} dibenarkan berdaftar dalam sistem.` })
    }
    const emailTaken = await prisma.user.findUnique({ where: { email } })
    if (emailTaken) return res.status(409).json({ error: 'Email telah digunakan oleh pengguna lain.' })
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(email && { email }),
      ...(role && { role }),
      ...(role && { sector: role === 'peneraju_sektor' ? sector : null }),
      ...(role && { state: role === 'penyelaras_jpn' ? state : null }),
      ...(isActive !== undefined && { isActive }),
    },
    select: { id: true, name: true, email: true, role: true, sector: true, state: true, isActive: true, updatedAt: true },
  })

  await prisma.auditLog.create({
    data: { userId: req.user.id, action: 'UPDATE', resourceType: 'users', resourceId: id, details: JSON.stringify(req.body) },
  })

  return res.json({ user })
}

const deleteUser = async (req, res) => {
  const { id } = req.params
  if (id === req.user.id) return res.status(400).json({ error: 'Anda tidak boleh memadam akaun sendiri.' })

  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Pengguna tidak dijumpai.' })

  await prisma.user.update({ where: { id }, data: { isActive: false } })

  await prisma.auditLog.create({
    data: { userId: req.user.id, action: 'DELETE', resourceType: 'users', resourceId: id },
  })

  return res.json({ message: 'Pengguna telah dinyahaktifkan.' })
}

const resetPassword = async (req, res) => {
  const { id } = req.params
  const { newPassword } = req.body
  if (!newPassword) return res.status(400).json({ error: 'Kata laluan baru diperlukan.' })

  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Pengguna tidak dijumpai.' })

  const passwordHash = await bcrypt.hash(newPassword, 12)
  // Same "admin-chosen password is temporary" rule as createUser above.
  await prisma.user.update({ where: { id }, data: { passwordHash, mustChangePassword: true } })

  await prisma.auditLog.create({
    data: { userId: req.user.id, action: 'RESET_PASSWORD', resourceType: 'users', resourceId: id },
  })

  return res.json({ message: 'Kata laluan berjaya ditetapkan semula.' })
}

module.exports = { listUsers, getUser, createUser, updateUser, deleteUser, resetPassword }
