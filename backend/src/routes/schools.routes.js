const router = require('express').Router()
const { listSchools, getSchool, createSchool, updateSchool } = require('../controllers/schools.controller')
const { authenticate } = require('../middleware/auth.middleware')
const { authorize } = require('../middleware/rbac.middleware')

router.use(authenticate)
router.get('/', listSchools)
router.get('/:id', getSchool)
router.post('/', authorize('admin'), createSchool)
router.put('/:id', authorize('admin'), updateSchool)

module.exports = router
