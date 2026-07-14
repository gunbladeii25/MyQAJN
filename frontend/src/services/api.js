import axios from 'axios'

const api = axios.create({ baseURL: '/api/v1' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// Auth
export const login = (data) => api.post('/auth/login', data)
export const getMe = () => api.get('/auth/me')
export const changePassword = (data) => api.put('/auth/change-password', data)
export const forgotPassword = (email) => api.post('/auth/forgot-password', { email })
export const verifyResetToken = (token) => api.get(`/auth/reset-password/${token}/verify`)
export const resetPasswordWithToken = (token, newPassword) => api.post('/auth/reset-password', { token, newPassword })

// Users
export const getUsers = (params) => api.get('/users', { params })
export const getUser = (id) => api.get(`/users/${id}`)
export const createUser = (data) => api.post('/users', data)
export const updateUser = (id, data) => api.put(`/users/${id}`, data)
export const deleteUser = (id) => api.delete(`/users/${id}`)
export const resetUserPassword = (id, data) => api.put(`/users/${id}/reset-password`, data)

// Schools
export const getSchools = (params) => api.get('/schools', { params })
export const getSchool = (id) => api.get(`/schools/${id}`)
export const createSchool = (data) => api.post('/schools', data)
export const updateSchool = (id, data) => api.put(`/schools/${id}`, data)

// Cases
export const getCases = (params) => api.get('/cases', { params })
export const getCase = (id) => api.get(`/cases/${id}`)
export const submitCase = (data) => api.post('/cases', data)
export const updateCaseStatus = (id, status) => api.put(`/cases/${id}/status`, { status })
export const getCaseStats = () => api.get('/cases/stats')
export const regenerateBrief = (id) => api.post(`/cases/${id}/regenerate-brief`)
export const respondToEscalation = (id, responseText) => api.post(`/cases/${id}/respond`, { responseText })
export const createEscalation = (caseId, data) => api.post(`/cases/${caseId}/escalations`, data)
export const updateEscalation = (caseId, escId, data) => api.put(`/cases/${caseId}/escalations/${escId}`, data)
export const deleteEscalation = (caseId, escId) => api.delete(`/cases/${caseId}/escalations/${escId}`)

// Briefs
export const getBriefs = () => api.get('/briefs')
export const getBrief = (caseId) => api.get(`/briefs/${caseId}`)
export const signBrief = (caseId, signType) => api.post(`/briefs/${caseId}/sign`, { signType })
export const bulkSignBriefs = (caseIds, signType) => api.post('/briefs/bulk-sign', { caseIds, signType })

// Reports
export const getDashboard = () => api.get('/reports/dashboard')
export const getDiTrend = (days) => api.get('/reports/di-trend', { params: { days } })
export const getBySector = () => api.get('/reports/by-sector')

// Ingestion — Sources
export const getIngestionSources = () => api.get('/ingestion/sources')
export const createIngestionSource = (data) => api.post('/ingestion/sources', data)
export const updateIngestionSource = (id, data) => api.put(`/ingestion/sources/${id}`, data)
export const deleteIngestionSource = (id) => api.delete(`/ingestion/sources/${id}`)

// Ingestion — Pull & Upload
export const triggerPull = (sourceId, data) => api.post(`/ingestion/sources/${sourceId}/pull`, data)
export const uploadIngestionDocument = (sourceId, formData) =>
  api.post(`/ingestion/sources/${sourceId}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })

// Ingestion — Runs
export const getIngestionRuns = () => api.get('/ingestion/runs')
export const getIngestionRun = (id) => api.get(`/ingestion/runs/${id}`)

// Ingestion — Records
export const getIngestionRecords = (params) => api.get('/ingestion/records', { params })
export const approveIngestionRecord = (id, data) => api.post(`/ingestion/records/${id}/approve`, data)
export const rejectIngestionRecord = (id, data) => api.post(`/ingestion/records/${id}/reject`, data)

// Ingestion — GDrive file listing (Pemeriksaan JN)
export const getGdriveFiles = (year) => api.get('/ingestion/gdrive/files', { params: { year } })

// Ingestion — Mapping Preview (Fasa B)
export const getMappingPreview = (sourceCode, schoolCodes) =>
  api.post('/ingestion/mapping-preview', { sourceCode, schoolCodes })

export const myraChat = (message, history) => api.post('/chat/myra', { message, history })

// Translation — lookup: DB-sahaja (semua peranan); generate: LLM + simpan (admin-sahaja)
export const lookupTranslations = (texts, targetLang) => api.post('/translate/lookup', { texts, targetLang })
export const generateTranslations = (texts, targetLang) => api.post('/translate/generate', { texts, targetLang })
