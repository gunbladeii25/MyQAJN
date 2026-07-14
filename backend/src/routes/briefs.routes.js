const router = require('express').Router()
const { listBriefs, getBrief, signBrief, bulkSignBriefs } = require('../controllers/briefs.controller')
const { authenticate } = require('../middleware/auth.middleware')
const { authorize } = require('../middleware/rbac.middleware')

const BRIEF_ROLES = ['admin', 'peneraju_sektor', 'top_management']

router.use(authenticate)
router.get('/', authorize(...BRIEF_ROLES), listBriefs)
router.post('/bulk-sign', authorize('top_management'), bulkSignBriefs)
router.get('/:caseId', authorize(...BRIEF_ROLES), getBrief)
router.post('/:caseId/sign', authorize('top_management'), signBrief)

module.exports = router
