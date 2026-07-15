import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, RotateCcw, Search } from 'lucide-react'
import { getUsers, createUser, updateUser, deleteUser, resetUserPassword } from '../services/api'
import { ROLES, SECTORS, MALAYSIA_STATES } from '../constants'
import { PageLoader } from '../components/ui/Spinner'
import Modal from '../components/ui/Modal'
import { useForm } from 'react-hook-form'

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // { type: 'create'|'edit'|'delete'|'reset', user? }
  const [apiError, setApiError] = useState('')

  const load = async () => {
    setLoading(true)
    const res = await getUsers({ search, limit: 50 })
    setUsers(res.data.users); setTotal(res.data.total)
    setLoading(false)
  }

  useEffect(() => { load() }, [search])

  const openCreate = () => { setApiError(''); setModal({ type: 'create' }) }
  const openEdit = (u) => { setApiError(''); setModal({ type: 'edit', user: u }) }
  const openDelete = (u) => setModal({ type: 'delete', user: u })
  const openReset = (u) => { setApiError(''); setModal({ type: 'reset', user: u }) }
  const closeModal = () => setModal(null)

  const handleDelete = async () => {
    await deleteUser(modal.user.id)
    closeModal(); load()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pengurusan Pengguna</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} pengguna berdaftar</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" /> Tambah Pengguna</button>
      </div>

      <div className="card p-4 flex items-center gap-3">
        <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <input className="flex-1 text-sm outline-none" placeholder="Cari nama atau e-mel..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        {loading ? <PageLoader /> : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Bil.</th>
                {['Nama', 'E-mel', 'Peranan', 'Sektor / Negeri', 'Status', 'Tindakan'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Tiada pengguna.</td></tr>
              )}
              {users.map((u, i) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 tabular-nums">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLES[u.role]?.color}`}>
                      {ROLES[u.role]?.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{u.sector || u.state || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.isActive ? 'bg-success-100 text-success-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.isActive ? 'Aktif' : 'Tidak Aktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(u)} className="p-1.5 hover:bg-primary-50 text-primary-600 rounded-lg transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => openReset(u)} className="p-1.5 hover:bg-warning-50 text-warning-600 rounded-lg transition-colors" title="Reset Password"><RotateCcw className="w-3.5 h-3.5" /></button>
                      <button onClick={() => openDelete(u)} className="p-1.5 hover:bg-danger-50 text-danger-600 rounded-lg transition-colors" title="Padam"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {(modal?.type === 'create' || modal?.type === 'edit') && (
        <UserFormModal
          mode={modal.type}
          user={modal.user}
          apiError={apiError}
          setApiError={setApiError}
          onClose={closeModal}
          onSuccess={() => { closeModal(); load() }}
        />
      )}

      {/* Delete Confirm */}
      <Modal open={modal?.type === 'delete'} onClose={closeModal} title="Padam Pengguna" size="sm">
        <p className="text-sm text-gray-600 mb-6">
          Adakah anda pasti ingin menyahaktifkan <strong>{modal?.user?.name}</strong>? Pengguna tidak akan dapat log masuk.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={closeModal} className="btn-secondary">Batal</button>
          <button onClick={handleDelete} className="btn-danger">Padam</button>
        </div>
      </Modal>

      {/* Reset Password */}
      {modal?.type === 'reset' && (
        <ResetPasswordModal user={modal.user} apiError={apiError} setApiError={setApiError}
          onClose={closeModal} onSuccess={() => { closeModal() }} />
      )}
    </div>
  )
}

function UserFormModal({ mode, user, apiError, setApiError, onClose, onSuccess }) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: mode === 'edit' ? { name: user.name, email: user.email, role: user.role, sector: user.sector || '', state: user.state || '', isActive: user.isActive } : {}
  })
  const role = watch('role')

  const onSubmit = async (data) => {
    setApiError('')
    try {
      if (mode === 'create') await createUser(data)
      else await updateUser(user.id, data)
      onSuccess()
    } catch (err) {
      setApiError(err.response?.data?.error || 'Ralat.')
    }
  }

  return (
    <Modal open size="md" onClose={onClose} title={mode === 'create' ? 'Tambah Pengguna Baru' : 'Edit Pengguna'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Nama Penuh <span className="text-danger-600">*</span></label>
          <input className="input" {...register('name', { required: 'Nama diperlukan' })} />
          {errors.name && <p className="text-danger-600 text-xs mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="label">E-mel <span className="text-danger-600">*</span></label>
          <input type="email" className="input" placeholder="nama@moe.gov.my" {...register('email', {
            required: 'E-mel diperlukan',
            pattern: { value: /@moe\.gov\.my$/i, message: 'Hanya e-mel domain @moe.gov.my dibenarkan.' },
          })} />
          {errors.email && <p className="text-danger-600 text-xs mt-1">{errors.email.message}</p>}
          <p className="text-xs text-gray-400 mt-1">
            {mode === 'edit' ? 'Menukar e-mel akan menukar alamat log masuk pengguna ini. ' : ''}
            Hanya domain rasmi @moe.gov.my dibenarkan berdaftar.
          </p>
        </div>
        {mode === 'create' && (
          <div>
            <label className="label">Kata Laluan <span className="text-danger-600">*</span></label>
            <input type="password" className="input" {...register('password', { required: 'Kata laluan diperlukan', minLength: { value: 8, message: 'Minimum 8 aksara' } })} />
            {errors.password && <p className="text-danger-600 text-xs mt-1">{errors.password.message}</p>}
          </div>
        )}
        <div>
          <label className="label">Peranan <span className="text-danger-600">*</span></label>
          <select className="input" {...register('role', { required: 'Peranan diperlukan' })}>
            <option value="">-- Pilih Peranan --</option>
            {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        {role === 'peneraju_sektor' && (
          <div>
            <label className="label">Sektor <span className="text-danger-600">*</span></label>
            <select className="input" {...register('sector', { required: 'Sektor diperlukan' })}>
              <option value="">-- Pilih Sektor --</option>
              {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        {role === 'penyelaras_jpn' && (
          <div>
            <label className="label">Negeri <span className="text-danger-600">*</span></label>
            <select className="input" {...register('state', { required: 'Negeri diperlukan' })}>
              <option value="">-- Pilih Negeri --</option>
              {MALAYSIA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">Kes yang dieskalasi bagi sekolah di negeri ini akan dihantar ke e-mel pengguna ini.</p>
          </div>
        )}
        {mode === 'edit' && (
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isActive" {...register('isActive')} />
            <label htmlFor="isActive" className="text-sm text-gray-700">Pengguna aktif</label>
          </div>
        )}
        {apiError && <div className="bg-danger-50 border border-danger-200 text-danger-700 text-sm rounded-lg px-4 py-3">{apiError}</div>}
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Batal</button>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? 'Menyimpan...' : mode === 'create' ? 'Cipta Pengguna' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ResetPasswordModal({ user, apiError, setApiError, onClose, onSuccess }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm()

  const onSubmit = async (data) => {
    setApiError('')
    try { await resetUserPassword(user.id, { newPassword: data.newPassword }); onSuccess() }
    catch (err) { setApiError(err.response?.data?.error || 'Ralat.') }
  }

  return (
    <Modal open size="sm" onClose={onClose} title={`Reset Kata Laluan — ${user?.name}`}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Kata Laluan Baru <span className="text-danger-600">*</span></label>
          <input type="password" className="input" {...register('newPassword', { required: true, minLength: { value: 8, message: 'Minimum 8 aksara' } })} />
          {errors.newPassword && <p className="text-danger-600 text-xs mt-1">{errors.newPassword.message}</p>}
        </div>
        {apiError && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-3">{apiError}</div>}
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">Batal</button>
          <button type="submit" disabled={isSubmitting} className="btn-primary">{isSubmitting ? 'Menyimpan...' : 'Reset Kata Laluan'}</button>
        </div>
      </form>
    </Modal>
  )
}
