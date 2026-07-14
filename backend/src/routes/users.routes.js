const router = require('express').Router()
const { listUsers, getUser, createUser, updateUser, deleteUser, resetPassword } = require('../controllers/users.controller')
const { authenticate } = require('../middleware/auth.middleware')
const { authorize } = require('../middleware/rbac.middleware')

router.use(authenticate, authorize('admin'))

router.get('/', listUsers)
router.post('/', createUser)
router.get('/:id', getUser)
router.put('/:id', updateUser)
router.delete('/:id', deleteUser)
router.put('/:id/reset-password', resetPassword)

module.exports = router
