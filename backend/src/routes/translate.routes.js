const router = require('express').Router()
const { lookupTranslations, generateTranslations } = require('../controllers/translate.controller')
const { authenticate } = require('../middleware/auth.middleware')
const { authorize } = require('../middleware/rbac.middleware')

router.use(authenticate)

// Semua peranan — DB-sahaja, tiada LLM.
router.post('/lookup', lookupTranslations)

// Admin-sahaja — alat pengarangan kandungan (LLM + simpan ke DB).
router.post('/generate', authorize('admin'), generateTranslations)

module.exports = router
