const express  = require('express')
const multer   = require('multer')
const router   = express.Router()
const ctrl     = require('../controllers/ingestion.controller')
const { authenticate } = require('../middleware/auth.middleware')
const { authorize }    = require('../middleware/rbac.middleware')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

// Peranan dengan akses laman Ingestion Data (sepadan dengan Sidebar + App.jsx)
const INGESTION_ROLES = ['admin', 'peneraju_sektor', 'penganalisis_data']

// ── Data Sources ───────────────────────────────────────────────────────────
router.get   ('/sources',          authenticate, authorize(...INGESTION_ROLES), ctrl.listSources)
router.post  ('/sources',          authenticate, authorize('admin', 'penganalisis_data'), ctrl.createSource)
router.put   ('/sources/:id',      authenticate, authorize('admin', 'penganalisis_data'), ctrl.updateSource)
router.delete('/sources/:id',      authenticate, authorize('admin'), ctrl.deleteSource)

// ── Pull + Upload ──────────────────────────────────────────────────────────
router.post  ('/sources/:sourceId/pull',   authenticate, authorize('admin', 'penganalisis_data'), ctrl.pullFromSource)
router.post  ('/sources/:sourceId/upload', authenticate, authorize('admin', 'penganalisis_data'), upload.single('file'), ctrl.uploadDocument)

// ── Ingestion Runs ─────────────────────────────────────────────────────────
router.get   ('/runs',    authenticate, authorize(...INGESTION_ROLES), ctrl.listRuns)
router.get   ('/runs/:id',authenticate, authorize(...INGESTION_ROLES), ctrl.getRun)

// ── Ingestion Records (semakan) ────────────────────────────────────────────
router.get   ('/records',            authenticate, authorize(...INGESTION_ROLES), ctrl.listRecords)
router.post  ('/records/:id/approve',authenticate, authorize('admin', 'peneraju_sektor', 'penganalisis_data'), ctrl.approveRecord)
router.post  ('/records/:id/reject', authenticate, authorize('admin', 'peneraju_sektor', 'penganalisis_data'), ctrl.rejectRecord)

// ── Scheduled pull (called by AI engine scheduler) ────────────────────────
router.post  ('/scheduled-pull', ctrl.scheduledPull)

// ── GDrive file listing (Pemeriksaan JN — file browser sebelum pull) ──────
router.get   ('/gdrive/files', authenticate, authorize(...INGESTION_ROLES), ctrl.listGdriveFiles)

// ── Mapping Preview (Fasa B — semak compatibility outsource ↔ JN baseline) ─
router.post  ('/mapping-preview', authenticate, authorize(...INGESTION_ROLES), ctrl.mappingPreview)

module.exports = router
