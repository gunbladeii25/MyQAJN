const axios = require('axios')
const { v4: uuidv4 } = require('uuid')
const prisma = require('../utils/prisma')
const logger = require('../utils/logger')
const { escalateToStatePic, sendEscalationEmail } = require('../utils/stateEscalation')
const sseHub = require('../utils/sseHub')

const AI_ENGINE = process.env.AI_ENGINE_URL || 'http://localhost:8000'

const generateCaseId = () => {
  const d = new Date()
  const yymm = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}`
  return `JN-${yymm}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
}

const parseJsonFields = (c) => {
  if (!c) return c
  const safeParse = (v, fallback = []) => { try { return JSON.parse(v) } catch { return fallback } }
  return {
    ...c,
    riskFlags: safeParse(c.riskFlags, []),
    agentAOutput: safeParse(c.agentAOutput, null),
    agentBOutput: safeParse(c.agentBOutput, null),
    executiveBrief: c.executiveBrief ? {
      ...c.executiveBrief,
      enforcementActions:    safeParse(c.executiveBrief.enforcementActions, []),
      policyRecommendations: safeParse(c.executiveBrief.policyRecommendations, []),
      legalReferences:       safeParse(c.executiveBrief.legalReferences, []),
      ragSources:            safeParse(c.executiveBrief.ragSources, []),
      directiveText:         safeParse(c.executiveBrief.directiveText, {}),
    } : null,
  }
}

const listCases = async (req, res) => {
  const { status, diClassification, alertLevel, schoolId, today, page = 1, limit = 50 } = req.query
  const skip = (parseInt(page) - 1) * parseInt(limit)

  const where = {}
  if (status) where.status = status
  if (diClassification) where.diClassification = diClassification
  if (alertLevel) where.alertLevel = alertLevel
  if (schoolId) where.schoolId = schoolId
  if (today === 'true') {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const end   = new Date(); end.setHours(23, 59, 59, 999)
    where.createdAt = { gte: start, lte: end }
  }

  // Peneraju sektor: hanya nampak kes dari sektor sendiri (via submittedBy.sector)
  if (req.user.role === 'peneraju_sektor') {
    where.submittedBy = { sector: req.user.sector }
  }
  // Penyelaras JPN: hanya nampak kes yang dieskalasi ke negeri mereka
  if (req.user.role === 'penyelaras_jpn') {
    where.escalations = { some: { userId: req.user.id } }
  }

  const [cases, total] = await Promise.all([
    prisma.case.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        school: { select: { schoolCode: true, schoolName: true, state: true } },
        submittedBy: { select: { name: true, sector: true } },
      },
    }),
    prisma.case.count({ where }),
  ])

  return res.json({ cases: cases.map(parseJsonFields), total, page: parseInt(page), limit: parseInt(limit) })
}

// Kes ini milik/dalam skop req.user? Menutup akses ID-terus di luar skop
// peranan (cth. Peneraju Sektor A cuba buka kes Peneraju Sektor B melalui
// URL terus) — skop yang sama seperti listCases, tetapi dikuatkuasakan di
// sini kerana getCase-by-ID tidak melalui penapisan senarai.
const _caseInScope = (req, c) => {
  if (req.user.role === 'peneraju_sektor') return c.submittedBy?.sector === req.user.sector
  if (req.user.role === 'penyelaras_jpn')  return c.escalations.some(e => e.userId === req.user.id)
  if (req.user.role === 'penganalisis_data') return false // ingestion-sahaja, tiada keperluan kes
  return true // admin, top_management
}

const getCase = async (req, res) => {
  const c = await prisma.case.findUnique({
    where: { id: req.params.id },
    include: {
      school: true,
      submittedBy: { select: { name: true, email: true, sector: true } },
      executiveBrief: true,
      escalations: {
        include: { user: { select: { name: true, email: true, state: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!c) return res.status(404).json({ error: 'Kes tidak dijumpai.' })
  if (!_caseInScope(req, c)) return res.status(403).json({ error: 'Anda tidak mempunyai kebenaran untuk melihat kes ini.' })
  return res.json({ case: parseJsonFields(c) })
}

// Snapshot terkini skor JnDomainScore sekolah (audit JN per domain SKPM),
// dihantar ke Agent C supaya syor tindakan spesifik kepada domain terlemah
// (Standard Kurikulum, HEM, dll.) — bukan kenyataan generik. Kes manual
// (submitCase) tiada mapping ingestion dua-belah, jadi kita hanya ada skor
// audit JN sahaja (satu pihak) — masih cukup untuk kenal pasti domain terlemah.
const _getLatestJnDomainScores = async (schoolId) => {
  const rows = await prisma.jnDomainScore.findMany({
    where: { schoolId },
    orderBy: { auditPeriod: 'desc' },
  })
  const latest = {}
  for (const r of rows) {
    if (!(r.domain in latest)) latest[r.domain] = r.domainScore
  }
  return latest
}

const submitCase = async (req, res) => {
  const { schoolId, operationalScore, incidentText, sourceSystem } = req.body

  if (!schoolId || operationalScore === undefined || !incidentText) {
    return res.status(400).json({ error: 'schoolId, operationalScore, dan incidentText diperlukan.' })
  }

  const school = await prisma.school.findUnique({ where: { id: schoolId } })
  if (!school) return res.status(404).json({ error: 'Sekolah tidak dijumpai.' })

  const jnDomainScores = await _getLatestJnDomainScores(schoolId)

  let aiResult
  try {
    const aiResp = await axios.post(`${AI_ENGINE}/ai/pipeline`, {
      school_id: school.schoolCode,
      school_name: school.schoolName,
      operational_score: parseFloat(operationalScore),
      jn_audit_score: school.jnAuditScore ? parseFloat(school.jnAuditScore) : null,
      incident_text: incidentText,
      integrity_risk_index: parseFloat(school.integrityRiskIndex),
      canteen_hygiene_score: school.canteenHygieneScore ? parseFloat(school.canteenHygieneScore) : null,
      last_audit_date: school.lastAuditDate,
      emis_access_suspended: school.emissAccessSuspended,
      jn_domain_scores: Object.keys(jnDomainScores).length ? jnDomainScores : null,
    }, { timeout: 60000 })
    aiResult = aiResp.data
  } catch (err) {
    logger.error(`AI engine error: ${err.message}`)
    return res.status(502).json({ error: 'AI engine tidak tersedia. Cuba sebentar lagi.' })
  }

  const { agent_a, agent_b, agent_c } = aiResult

  const newCase = await prisma.case.create({
    data: {
      caseId: generateCaseId(),
      schoolId,
      submittedById: req.user.id,
      operationalScore: parseFloat(operationalScore),
      jnAuditScore: agent_b.jn_audit_score_used,
      discrepancyIndex: agent_b.di_value,
      diClassification: agent_b.di_classification,
      alertLevel: agent_b.alert_level,
      anomalyDetected: agent_b.anomaly_detected,
      incidentText,
      category: agent_a.category,
      severity: agent_a.severity,
      agentAConfidence: agent_a.confidence,
      agentBConfidence: agent_b.confidence,
      riskFlags: JSON.stringify(agent_b.risk_flags),
      anomalyScore: agent_b.anomaly_score,
      payloadChecksum: agent_a.checksum,
      sourceSystem: sourceSystem || 'manual',
      agentAOutput: JSON.stringify(agent_a),
      agentBOutput: JSON.stringify(agent_b),
    },
  })

  // Save executive brief
  await prisma.executiveBrief.create({
    data: {
      caseId: newCase.id,
      enforcementActions: JSON.stringify(agent_c.enforcement_actions),
      policyRecommendations: JSON.stringify(agent_c.policy_recommendations),
      legalReferences: JSON.stringify(agent_c.legal_references),
      directiveText: agent_c.directive_text,
      ragSources: JSON.stringify(agent_c.rag_sources || []),
      llmModelUsed: agent_c.model_used,
      llmPromptHash: agent_c.prompt_hash,
    },
  })

  await prisma.auditLog.create({
    data: { userId: req.user.id, action: 'CREATE', resourceType: 'cases', resourceId: newCase.id },
  })

  logger.info(`Case submitted: ${newCase.caseId} by ${req.user.email}`)

  // Eskalasi ke Penyelaras JPN negeri (selepas syor Agent C sedia). Kegagalan
  // e-mel individu ditangkap dalam helper (emailStatus='failed') — sebarang
  // ralat tidak dijangka di sini tidak menggagalkan penciptaan kes itu sendiri.
  try {
    await escalateToStatePic({ caseRecord: newCase, directiveText: agent_c.directive_text, school })
  } catch (err) {
    logger.error(`Escalation error for ${newCase.caseId}: ${err.message}`)
  }

  const result = await prisma.case.findUnique({
    where: { id: newCase.id },
    include: { school: true, executiveBrief: true },
  })

  return res.status(201).json({ case: parseJsonFields(result) })
}

const updateCaseStatus = async (req, res) => {
  const { status } = req.body
  const validStatuses = ['pending', 'reviewed', 'escalated', 'closed']
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Status tidak sah.' })
  }

  const c = await prisma.case.findUnique({ where: { id: req.params.id } })
  if (!c) return res.status(404).json({ error: 'Kes tidak dijumpai.' })

  const updated = await prisma.case.update({
    where: { id: req.params.id },
    data: { status },
  })

  await prisma.auditLog.create({
    data: { userId: req.user.id, action: 'UPDATE_STATUS', resourceType: 'cases', resourceId: c.id, details: JSON.stringify({ status }) },
  })

  return res.json({ case: updated })
}

const getCaseStats = async (req, res) => {
  const where = {}
  if (req.user.role === 'peneraju_sektor') {
    where.submittedBy = { sector: req.user.sector }
  }
  if (req.user.role === 'penyelaras_jpn') {
    where.escalations = { some: { userId: req.user.id } }
  }

  const [total, byAlert, byStatus, byClassification] = await Promise.all([
    prisma.case.count({ where }),
    prisma.case.groupBy({ by: ['alertLevel'], where, _count: true }),
    prisma.case.groupBy({ by: ['status'], where, _count: true }),
    prisma.case.groupBy({ by: ['diClassification'], where, _count: true }),
  ])

  return res.json({ total, byAlert, byStatus, byClassification })
}

const regenerateBrief = async (req, res) => {
  const c = await prisma.case.findUnique({
    where: { id: req.params.id },
    include: { school: true, executiveBrief: true },
  })
  if (!c) return res.status(404).json({ error: 'Kes tidak dijumpai.' })

  const safeParse = (v, fallback = {}) => { try { return JSON.parse(v) } catch { return fallback } }
  const agent_a = safeParse(c.agentAOutput, {})
  const agent_b = safeParse(c.agentBOutput, {})

  const jnDomainScores = await _getLatestJnDomainScores(c.schoolId)

  let agent_c_result
  try {
    const aiResp = await axios.post(`${AI_ENGINE}/ai/agent-c`, {
      school_id: c.school.schoolCode,
      school_name: c.school.schoolName,
      operational_score: parseFloat(c.operationalScore),
      jn_audit_score: c.jnAuditScore ? parseFloat(c.jnAuditScore) : null,
      incident_text: c.incidentText || '',
      integrity_risk_index: parseFloat(c.school.integrityRiskIndex || 0),
      canteen_hygiene_score: c.school.canteenHygieneScore ? parseFloat(c.school.canteenHygieneScore) : null,
      last_audit_date: c.school.lastAuditDate,
      emis_access_suspended: c.school.emissAccessSuspended || false,
      jn_domain_scores: Object.keys(jnDomainScores).length ? jnDomainScores : null,
    }, { timeout: 120000 })
    agent_c_result = aiResp.data
  } catch (err) {
    logger.error(`Agent C regenerate error: ${err.message}`)
    return res.status(502).json({ error: 'AI engine tidak tersedia.' })
  }

  const brief = await prisma.executiveBrief.upsert({
    where: { caseId: c.id },
    update: {
      enforcementActions: JSON.stringify(agent_c_result.enforcement_actions),
      policyRecommendations: JSON.stringify(agent_c_result.policy_recommendations),
      legalReferences: JSON.stringify(agent_c_result.legal_references),
      directiveText: agent_c_result.directive_text,
      ragSources: JSON.stringify(agent_c_result.rag_sources || []),
      llmModelUsed: agent_c_result.model_used,
      llmPromptHash: agent_c_result.prompt_hash,
    },
    create: {
      caseId: c.id,
      enforcementActions: JSON.stringify(agent_c_result.enforcement_actions),
      policyRecommendations: JSON.stringify(agent_c_result.policy_recommendations),
      legalReferences: JSON.stringify(agent_c_result.legal_references),
      directiveText: agent_c_result.directive_text,
      ragSources: JSON.stringify(agent_c_result.rag_sources || []),
      llmModelUsed: agent_c_result.model_used,
      llmPromptHash: agent_c_result.prompt_hash,
    },
  })

  logger.info(`Brief regenerated for case ${c.caseId} — model: ${agent_c_result.model_used}`)
  return res.json({ brief })
}

// Penyelaras JPN memberi respons rasmi negeri terhadap syor Agent C bagi kes
// yang dieskalasi kepada mereka. Satu Penyelaras JPN hanya boleh respons
// eskalasi milik mereka sendiri (bukan eskalasi negeri lain).
const respondToEscalation = async (req, res) => {
  const { responseText } = req.body
  if (!responseText || responseText.trim().length < 5) {
    return res.status(400).json({ error: 'Teks respons diperlukan (min 5 aksara).' })
  }

  const escalation = await prisma.caseEscalation.findFirst({
    where: { caseId: req.params.id, userId: req.user.id },
  })
  if (!escalation) return res.status(404).json({ error: 'Kes ini tidak dieskalasi kepada anda.' })

  const updated = await prisma.caseEscalation.update({
    where: { id: escalation.id },
    data: { responseText, status: 'responded', respondedAt: new Date() },
  })

  await prisma.auditLog.create({
    data: {
      userId: req.user.id, action: 'RESPOND_ESCALATION', resourceType: 'cases',
      resourceId: req.params.id, details: JSON.stringify({ responseText }),
    },
  })

  // Notify any admin/top_management/peneraju_sektor Dashboard currently open
  // (sseHub.broadcast scopes peneraju_sektor to their own sector, same as
  // the Dashboard's own _scopedCaseWhere in reports.controller.js).
  const parentCase = await prisma.case.findUnique({
    where: { id: escalation.caseId },
    include: { school: { select: { schoolName: true } }, submittedBy: { select: { sector: true } } },
  })
  if (parentCase) {
    sseHub.broadcast('jpn-response', {
      caseId: parentCase.caseId,
      schoolName: parentCase.school?.schoolName,
      state: escalation.state,
      respondedAt: updated.respondedAt,
    }, { sector: parentCase.submittedBy?.sector })
  }

  logger.info(`Penyelaras JPN ${req.user.email} respond ke kes ${req.params.id}`)
  return res.json({ escalation: updated })
}

// ─────────────────────────────────────────────────────────────────────────
// Admin-only CRUD ke atas baris eskalasi (CaseEscalation) bagi satu kes —
// membolehkan Administrator membetulkan salah PIC, padam baris tersalah, atau
// tambah PIC tambahan secara manual, di luar aliran automatik
// escalateToStatePic (dipanggil semasa penciptaan kes).
// ─────────────────────────────────────────────────────────────────────────

// Tambah PIC (Penyelaras JPN) tambahan secara manual ke senarai eskalasi kes
// ini, dan terus hantar e-mel eskalasi kepadanya.
const createEscalation = async (req, res) => {
  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'userId diperlukan.' })

  const c = await prisma.case.findUnique({
    where: { id: req.params.id },
    include: { school: true, executiveBrief: true },
  })
  if (!c) return res.status(404).json({ error: 'Kes tidak dijumpai.' })

  const pic = await prisma.user.findUnique({ where: { id: userId } })
  if (!pic || pic.role !== 'penyelaras_jpn') {
    return res.status(400).json({ error: 'Pengguna bukan Penyelaras JPN yang sah.' })
  }

  const existing = await prisma.caseEscalation.findFirst({ where: { caseId: c.id, userId: pic.id } })
  if (existing) return res.status(409).json({ error: 'PIC ini sudah berada dalam senarai eskalasi kes ini.' })

  const escalation = await prisma.caseEscalation.create({
    data: { caseId: c.id, state: pic.state || c.school.state, userId: pic.id, emailStatus: 'pending' },
  })
  await sendEscalationEmail({
    escalationId: escalation.id, caseRecord: c, school: c.school, pic,
    directiveText: c.executiveBrief?.directiveText || '',
  })

  await prisma.auditLog.create({
    data: { userId: req.user.id, action: 'CREATE_ESCALATION', resourceType: 'case_escalations', resourceId: escalation.id, details: JSON.stringify({ caseId: c.id, picId: pic.id }) },
  })

  const result = await prisma.caseEscalation.findUnique({
    where: { id: escalation.id },
    include: { user: { select: { name: true, email: true, state: true } } },
  })
  return res.status(201).json({ escalation: result })
}

// Kemas kini baris eskalasi (negeri, status, respons) atau hantar semula e-mel.
const updateEscalation = async (req, res) => {
  const { state, status, responseText, resend } = req.body

  const escalation = await prisma.caseEscalation.findFirst({
    where: { id: req.params.escId, caseId: req.params.id },
    include: { user: true },
  })
  if (!escalation) return res.status(404).json({ error: 'Rekod eskalasi tidak dijumpai.' })

  if (resend) {
    if (!escalation.user) return res.status(400).json({ error: 'Tiada PIC pada rekod ini untuk dihantar e-mel.' })
    const c = await prisma.case.findUnique({
      where: { id: req.params.id },
      include: { school: true, executiveBrief: true },
    })
    await sendEscalationEmail({
      escalationId: escalation.id, caseRecord: c, school: c.school, pic: escalation.user,
      directiveText: c.executiveBrief?.directiveText || '',
    })
  }

  const data = {}
  if (state !== undefined) data.state = state
  if (status !== undefined) data.status = status
  if (responseText !== undefined) {
    data.responseText = responseText
    data.respondedAt = responseText ? new Date() : null
    if (!status) data.status = responseText ? 'responded' : 'pending'
  }

  const updated = await prisma.caseEscalation.update({
    where: { id: escalation.id },
    data,
    include: { user: { select: { name: true, email: true, state: true } } },
  })

  await prisma.auditLog.create({
    data: { userId: req.user.id, action: 'UPDATE_ESCALATION', resourceType: 'case_escalations', resourceId: escalation.id, details: JSON.stringify({ state, status, resend: !!resend }) },
  })

  return res.json({ escalation: updated })
}

// Padam baris eskalasi (cth. PIC ditambah tersilap).
const deleteEscalation = async (req, res) => {
  const escalation = await prisma.caseEscalation.findFirst({
    where: { id: req.params.escId, caseId: req.params.id },
  })
  if (!escalation) return res.status(404).json({ error: 'Rekod eskalasi tidak dijumpai.' })

  await prisma.caseEscalation.delete({ where: { id: escalation.id } })

  await prisma.auditLog.create({
    data: { userId: req.user.id, action: 'DELETE_ESCALATION', resourceType: 'case_escalations', resourceId: escalation.id, details: JSON.stringify({ caseId: req.params.id }) },
  })

  return res.status(204).send()
}

module.exports = {
  listCases, getCase, submitCase, updateCaseStatus, getCaseStats, regenerateBrief, respondToEscalation,
  createEscalation, updateEscalation, deleteEscalation,
}
