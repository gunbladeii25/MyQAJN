const router = require('express').Router()
const { login, getMe, changePassword, forgotPassword, verifyResetToken, resetPassword } = require('../controllers/auth.controller')
const { authenticate } = require('../middleware/auth.middleware')

router.post('/login', login)
router.get('/me', authenticate, getMe)
router.put('/change-password', authenticate, changePassword)
router.post('/forgot-password', forgotPassword)
router.get('/reset-password/:token/verify', verifyResetToken)
router.post('/reset-password', resetPassword)

module.exports = router
