require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')

const authRoutes = require('./routes/auth.routes')
const userRoutes = require('./routes/users.routes')
const schoolRoutes = require('./routes/schools.routes')
const caseRoutes = require('./routes/cases.routes')
const briefRoutes = require('./routes/briefs.routes')
const reportRoutes    = require('./routes/reports.routes')
const ingestionRoutes = require('./routes/ingestion.routes')
const chatRoutes      = require('./routes/chat.routes')
const translateRoutes = require('./routes/translate.routes')
const logger = require('./utils/logger')

const app = express()

app.use(helmet())
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }))
app.use(morgan('dev'))
app.use(express.json({ limit: '10mb' }))

// Rate limit for login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Terlalu banyak percubaan log masuk. Cuba lagi dalam 15 minit.' },
})

// Rate limit untuk forgot-password — elak spam e-mel reset / percubaan
// meneka token secara berulang-ulang.
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { error: 'Terlalu banyak permintaan reset kata laluan. Cuba lagi dalam 15 minit.' },
})

app.use('/api/v1/auth/login', loginLimiter)
app.use('/api/v1/auth/forgot-password', forgotPasswordLimiter)
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/users', userRoutes)
app.use('/api/v1/schools', schoolRoutes)
app.use('/api/v1/cases', caseRoutes)
app.use('/api/v1/briefs', briefRoutes)
app.use('/api/v1/reports',   reportRoutes)
app.use('/api/v1/ingestion', ingestionRoutes)
app.use('/api/v1/chat',      chatRoutes)
app.use('/api/v1/translate', translateRoutes)

app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', service: 'MyQA@JN Backend', timestamp: new Date().toISOString() })
})

app.use((err, req, res, next) => {
  logger.error(err.stack)
  res.status(err.status || 500).json({ error: err.message || 'Ralat server dalaman.' })
})

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason instanceof Error ? reason.stack : reason}`)
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  logger.info(`MyQA@JN Backend berjalan di port ${PORT}`)
})
