const router = require('express').Router()
const {
  listCases, getCase, submitCase, updateCaseStatus, getCaseStats, regenerateBrief, respondToEscalation,
  createEscalation, updateEscalation, deleteEscalation,
} = require('../controllers/cases.controller')
const { authenticate } = require('../middleware/auth.middleware')
const { authorize } = require('../middleware/rbac.middleware')

// Peranan dengan akses kes (sepadan dengan Sidebar + App.jsx) — penganalisis_data
// ingestion-sahaja, tiada keperluan kes.
const CASE_ROLES = ['admin', 'peneraju_sektor', 'top_management', 'penyelaras_jpn']

router.use(authenticate)
router.get('/stats', authorize(...CASE_ROLES), getCaseStats)
router.get('/', authorize(...CASE_ROLES), listCases)
router.post('/', authorize('admin', 'peneraju_sektor'), submitCase)
router.get('/:id', authorize(...CASE_ROLES), getCase)
router.put('/:id/status', authorize('admin', 'peneraju_sektor'), updateCaseStatus)
router.post('/:id/regenerate-brief', authorize('admin', 'peneraju_sektor'), regenerateBrief)
router.post('/:id/respond', authorize('penyelaras_jpn'), respondToEscalation)

// CRUD ke atas baris eskalasi (CaseEscalation) — Administrator sahaja, ketat
// memandangkan ia boleh menyunting/padam rekod respons rasmi negeri.
router.post('/:id/escalations', authorize('admin'), createEscalation)
router.put('/:id/escalations/:escId', authorize('admin'), updateEscalation)
router.delete('/:id/escalations/:escId', authorize('admin'), deleteEscalation)

module.exports = router
