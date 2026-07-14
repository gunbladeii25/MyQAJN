const bcrypt = require('bcryptjs')
const prisma = require('../utils/prisma')
const logger = require('../utils/logger')

// Keselamatan: hanya e-mel domain rasmi KPM dibenarkan berdaftar dalam sistem
// — mengelakkan akaun domain luar (outsource) daripada didaftarkan.
const ALLOWED_EMAIL_DOMAIN = '@moe.gov.my'
const isAllowedEmail = (email) => email.toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN)

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
  const { name, email, password, role, sector, state } = req.body

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Nama, email, kata laluan, dan peranan diperlukan.' })
  }
  if (!isAllowedEmail(email)) {
    return res.status(400).json({ error: `Hanya e-mel domain ${ALLOWED_EMAIL_DOMAIN} dibenarkan berdaftar dalam sistem.` })
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
    data: { name, email, passwordHash, role, sector: sector || null, state: state || null },
    select: { id: true, name: true, email: true, role: true, sector: true, state: true, isActive: true, createdAt: true },
  })

  await prisma.auditLog.create({
    data: { userId: req.user.id, action: 'CREATE', resourceType: 'users', resourceId: user.id, details: JSON.stringify({ name, email, role }) },
  })

  logger.info(`User created: ${email} by ${req.user.email}`)
  return res.status(201).json({ user })
}

const updateUser = async (req, res) => {
  const { name, email, role, sector, state, isActive } = req.body
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
      return res.status(400).json({ error: `Hanya e-mel domain ${ALLOWED_EMAIL_DOMAIN} dibenarkan berdaftar dalam sistem.` })
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
  await prisma.user.update({ where: { id }, data: { passwordHash } })

  await prisma.auditLog.create({
    data: { userId: req.user.id, action: 'RESET_PASSWORD', resourceType: 'users', resourceId: id },
  })

  return res.json({ message: 'Kata laluan berjaya ditetapkan semula.' })
}

module.exports = { listUsers, getUser, createUser, updateUser, deleteUser, resetPassword }
