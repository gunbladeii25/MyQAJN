const jwt = require('jsonwebtoken')
const prisma = require('../utils/prisma')

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token tidak disediakan.' })
  }

  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } })
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Pengguna tidak sah atau tidak aktif.' })
    }
    req.user = user
    next()
  } catch {
    return res.status(401).json({ error: 'Token tidak sah atau telah tamat tempoh.' })
  }
}

module.exports = { authenticate }
