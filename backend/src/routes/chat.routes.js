const router = require('express').Router()
const { myraChat, myraTts } = require('../controllers/chat.controller')
const { authenticate } = require('../middleware/auth.middleware')

router.use(authenticate)
router.post('/myra', myraChat)
router.get('/tts',   myraTts)

module.exports = router
