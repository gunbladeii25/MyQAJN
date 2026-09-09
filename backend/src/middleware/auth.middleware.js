const jwt = require('jsonwebtoken')
const prisma = require('../utils/prisma')

// authenticate() is reused across every route file, so it doesn't know its
// own mount path at the call site — matching against the full request URL
// is the only way to exempt just these two endpoints below.
const MUST_CHANGE_PASSWORD_ALLOWED_PATHS = ['/api/v1/auth/change-password', '/api/v1/auth/me']

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
    if (user.mustChangePassword && !MUST_CHANGE_PASSWORD_ALLOWED_PATHS.includes(req.originalUrl.split('?')[0])) {
      return res.status(403).json({ error: 'Sila tetapkan kata laluan baharu terlebih dahulu.', code: 'MUST_CHANGE_PASSWORD' })
    }
    req.user = user
    next()
  } catch {
    return res.status(401).json({ error: 'Token tidak sah atau telah tamat tempoh.' })
  }
}

module.exports = { authenticate }
