const jwt = require('jsonwebtoken')
const prisma = require('../utils/prisma')

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization
  // Browsers' native EventSource API can't set custom request headers, so
  // SSE endpoints (dashboard/stream) pass the JWT as ?token= instead — same
  // verification below, just a second place to read the token from.
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.split(' ')[1]
    : req.query.token

  if (!token) {
    return res.status(401).json({ error: 'Token tidak disediakan.' })
  }

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
