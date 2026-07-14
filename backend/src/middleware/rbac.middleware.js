const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Tidak disahkan.' })
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Anda tidak mempunyai kebenaran untuk tindakan ini.' })
    }
    next()
  }
}

module.exports = { authorize }
