const router = require('express').Router()
const { dashboard, diTrend, bySector } = require('../controllers/reports.controller')
const { authenticate } = require('../middleware/auth.middleware')
const { authorize } = require('../middleware/rbac.middleware')

router.use(authenticate)
// penganalisis_data (ingestion-sahaja) tiada keperluan laporan kes/DI.
router.get('/dashboard', authorize('admin', 'peneraju_sektor', 'top_management', 'penyelaras_jpn'), dashboard)
router.get('/di-trend',  authorize('admin', 'peneraju_sektor', 'top_management', 'penyelaras_jpn'), diTrend)
// Pecahan merentas SEMUA sektor — paparan eksekutif sahaja, bukan untuk
// peranan yang skopnya sepatutnya terhad kepada sektor/negeri sendiri.
router.get('/by-sector', authorize('admin', 'top_management'), bySector)

module.exports = router
