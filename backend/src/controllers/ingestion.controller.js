const axios = require('axios')
const FormData = require('form-data')
const prisma = require('../utils/prisma')
const logger = require('../utils/logger')
const { escalateToStatePic } = require('../utils/stateEscalation')

const AI = process.env.AI_ENGINE_URL || 'http://localhost:8000'

// ── Helper: parse JSON string fields ─────────────────────────────────────────
const safeParse = (v, fallback = {}) => { try { return JSON.parse(v) } catch { return fallback } }

const parseRecord = (r) => ({
  ...r,
  extractedScores: safeParse(r.extractedScores, {}),
  mappedScores:    safeParse(r.mappedScores, {}),
  domainDi:        safeParse(r.domainDi, {}),
})

// ── Helper: skor JN per standard SKPM terkini untuk senarai sekolah ──────────
// Ambil baris JnDomainScore tempoh audit TERKINI per (sekolah, domain) —
// sumber terbaru menang jika tempoh sama. Returns {schoolCode: {domain: skor}}.
// Dihantar ke AI engine supaya DI dikira per standard (apple-to-apple).
const _latestJnDomainMap = async (schools) => {
  const rows = await prisma.jnDomainScore.findMany({
    where:   { schoolId: { in: schools.map(s => s.id) } },
    orderBy: [{ auditPeriod: 'desc' }, { updatedAt: 'desc' }],
  })
  const codeById = Object.fromEntries(schools.map(s => [s.id, s.schoolCode]))
  const map = {}
  for (const row of rows) {
    const code = codeById[row.schoolId]
    if (!map[code]) map[code] = {}
    // rows sudah tersusun terkini dahulu — kekalkan nilai pertama per domain
    if (map[code][row.domain] === undefined) map[code][row.domain] = row.domainScore
  }
  return map
}

// ═════════════════════════════════════════════════════════════════════════════
// DATA SOURCES
// ═════════════════════════════════════════════════════════════════════════════

const listSources = async (req, res) => {
  const sources = await prisma.dataSource.findMany({ orderBy: { createdAt: 'asc' } })
  return res.json({ sources })
}

const createSource = async (req, res) => {
  const { name, sourceCode, sourceType, apiUrl, apiAuthType, apiAuthToken, pullSchedule, fieldMappings, description } = req.body
  if (!name || !sourceCode || !sourceType) {
    return res.status(400).json({ error: 'name, sourceCode, sourceType diperlukan.' })
  }
  const existing = await prisma.dataSource.findUnique({ where: { sourceCode } })
  if (existing) return res.status(409).json({ error: 'sourceCode sudah wujud.' })

  const source = await prisma.dataSource.create({
    data: {
      name, sourceCode, sourceType,
      apiUrl: apiUrl || null,
      apiAuthType: apiAuthType || null,
      apiAuthToken: apiAuthToken || null,
      pullSchedule: pullSchedule || 'manual',
      fieldMappings: JSON.stringify(fieldMappings || {}),
      description: description || null,
    }
  })
  return res.status(201).json({ source })
}

const updateSource = async (req, res) => {
  const s = await prisma.dataSource.findUnique({ where: { id: req.params.id } })
  if (!s) return res.status(404).json({ error: 'Sumber tidak dijumpai.' })

  const { name, isActive, apiUrl, apiAuthToken, pullSchedule, fieldMappings, description } = req.body
  const updated = await prisma.dataSource.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(isActive !== undefined && { isActive }),
      ...(apiUrl !== undefined && { apiUrl }),
      ...(apiAuthToken !== undefined && { apiAuthToken }),
      ...(pullSchedule !== undefined && { pullSchedule }),
      ...(fieldMappings !== undefined && { fieldMappings: JSON.stringify(fieldMappings) }),
      ...(description !== undefined && { description }),
    }
  })
  return res.json({ source: updated })
}

const deleteSource = async (req, res) => {
  const s = await prisma.dataSource.findUnique({ where: { id: req.params.id } })
  if (!s) return res.status(404).json({ error: 'Sumber tidak dijumpai.' })
  await prisma.dataSource.delete({ where: { id: req.params.id } })
  return res.json({ message: 'Sumber dipadam.' })
}

// ═════════════════════════════════════════════════════════════════════════════
// PULL — Router: JN Baseline vs Outsource
// ═════════════════════════════════════════════════════════════════════════════

const pullFromSource = async (req, res) => {
  const { sourceId } = req.params
  const { schoolIds, month, year, domains, gdriveFileIds } = req.body

  const source = await prisma.dataSource.findUnique({ where: { id: sourceId } })
  if (!source) return res.status(404).json({ error: 'Sumber tidak dijumpai.' })
  if (!source.isActive) return res.status(400).json({ error: 'Sumber tidak aktif.' })

  const whereSchool = schoolIds?.length ? { id: { in: schoolIds } } : {}
  const schools = await prisma.school.findMany({ where: whereSchool })
  if (!schools.length) return res.status(404).json({ error: 'Tiada sekolah dijumpai.' })

  // Route based on source category
  if (source.sourceCategory === 'jn_baseline') {
    return _pullJnBaseline(req, res, source, schools, month, year, domains, gdriveFileIds)
  }
  return _pullOutsource(req, res, source, schools, month, year)
}

// ── Helper: simpan baseline JN untuk satu sekolah ────────────────────────────
// Upsert JnDomainScore per domain DAHULU, kemudian kira komposit dan kemaskini
// School.jnAuditScore. Bagi tarikan separa (subset standard), rec.jn_composite_score
// hanya merangkumi domain yang ditarik — komposit sebenar dikira semula daripada
// SEMUA baris JnDomainScore (baru + sedia ada) untuk tempoh audit yang sama,
// berwajaran mengikut rec.domain_weights (dinormalisasi atas domain yang wujud).
// Sumber tanpa domain_weights (SKPK/PEMERIKSAAN_JN) kekal guna rec.jn_composite_score.
// rec.domain_scores: {domain: {label, komponen, score, aspect_scores}}
// Returns: komposit akhir yang disimpan ke School.jnAuditScore.
const _saveJnBaseline = async (school, rec, sourceCode, pullDate) => {
  const auditPeriod = rec.audit_period || pullDate.slice(0, 7)
  const domainScores = rec.domain_scores || {}
  for (const [domain, d] of Object.entries(domainScores)) {
    if (d?.score == null) continue
    const data = {
      domainLabel:  d.label || domain,
      komponen:     d.komponen || null,
      domainScore:  d.score,
      aspectScores: JSON.stringify(d.aspect_scores || {}),
      pullDate,
    }
    await prisma.jnDomainScore.upsert({
      where: {
        schoolId_sourceCode_domain_auditPeriod: {
          schoolId: school.id, sourceCode, domain, auditPeriod,
        },
      },
      update: data,
      create: { schoolId: school.id, sourceCode, domain, auditPeriod, ...data },
    })
  }

  // Komposit dikira dari nilai TERKINI per domain MERENTAS sumber (sama
  // seperti pecahan dalam school picker) — cth. syor Pemeriksaan JN yang
  // meliputi 4 standard digabung dengan 4 standard SK@S sedia ada, bukan
  // dinormalisasi atas 4 sahaja. Wajaran instrumen lain (cth. SKPK) tidak
  // wujud dalam `weights`, jadi domain instrumen berbeza terkecuali sendiri.
  let composite = rec.jn_composite_score
  const weights = rec.domain_weights
  if (weights && Object.keys(weights).length > 0) {
    const rows = await prisma.jnDomainScore.findMany({
      where:   { schoolId: school.id },
      orderBy: [{ auditPeriod: 'desc' }, { updatedAt: 'desc' }],
    })
    const latestPerDomain = {}
    for (const r of rows) {
      if (weights[r.domain] == null) continue
      if (latestPerDomain[r.domain] === undefined) latestPerDomain[r.domain] = r.domainScore
    }
    const domains = Object.keys(latestPerDomain)
    if (domains.length > 0) {
      const totalW = domains.reduce((sum, d) => sum + weights[d], 0)
      composite = Math.round(
        (domains.reduce((sum, d) => sum + latestPerDomain[d] * weights[d], 0) / totalW) * 100
      ) / 100
    }
  }

  await prisma.school.update({
    where: { id: school.id },
    data: {
      jnAuditScore:  composite,
      lastAuditDate: pullDate,
    },
  })
  return composite
}

// ── Fasa A: Pull JN Baseline → kemaskini School.jnAuditScore ─────────────────
// domains (SKAS sahaja): subset kunci domain SKPM untuk tarikan separa.
const _pullJnBaseline = async (req, res, source, schools, month, year, domains, gdriveFileIds) => {
  const schoolCodes = schools.map(s => s.schoolCode)
  const now = new Date()
  const selDomains = Array.isArray(domains) && domains.length ? domains : null

  const run = await prisma.ingestionRun.create({
    data: {
      sourceId:      source.id,
      runType:       'manual',
      runCategory:   'jn_baseline',
      triggeredById: req.user.id,
      status:        'running',
    }
  })

  try {
    const aiResp = await axios.post(`${AI}/ai/ingest/jn-baseline`, {
      source_code:  source.sourceCode,
      school_codes: schoolCodes,
      month:        month || now.getMonth() + 1,
      year:         year  || now.getFullYear(),
      ...(selDomains && { domains: selDomains }),
      ...(gdriveFileIds?.length && { gdrive_file_ids: gdriveFileIds }),
    }, { timeout: 120000 })

    const { records } = aiResp.data
    let updated = 0
    const updatedSchools = []
    const failedSchools = []   // rec.error (cth. fail syor tiada dalam Drive) — dedah ke UI, jangan senyapkan

    for (const rec of records) {
      if (rec.error || rec.jn_composite_score == null) {
        const school = schools.find(s => s.schoolCode === rec.school_code)
        failedSchools.push({
          schoolCode: rec.school_code,
          schoolName: school?.schoolName || rec.school_code,
          error:      rec.error || 'Tiada skor komposit dikembalikan oleh sumber.',
        })
        continue
      }
      const school = schools.find(s => s.schoolCode === rec.school_code)
      if (!school) continue

      const pullDate = rec.pull_date || now.toISOString().slice(0, 10)
      const composite = await _saveJnBaseline(school, rec, source.sourceCode, pullDate)
      updated++
      updatedSchools.push({
        schoolCode:   rec.school_code,
        schoolName:   school.schoolName,
        jnAuditScore: composite,
        partial:      rec.partial || false,
        domainScores: rec.domain_scores || rec.dimension_scores || {},
        sourceFile:   rec.source_file_name || null,
        inspectionTheme: rec.inspection_theme || null,
      })
    }

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status:         'completed',
        completedAt:    now.toISOString(),
        recordsCreated: updated,
        summary:        JSON.stringify({
          source: source.sourceCode, schoolsUpdated: updated, runCategory: 'jn_baseline',
          ...(selDomains && { domains: selDomains }),
          ...(failedSchools.length && { failed: failedSchools }),
        }),
      }
    })

    logger.info(`JN Baseline pull complete: ${updated} schools updated, ${failedSchools.length} failed, from ${source.sourceCode}${selDomains ? ` (domains: ${selDomains.join(', ')})` : ''}`)
    return res.json({
      runCategory:   'jn_baseline',
      run:           { id: run.id, status: 'completed', recordsCreated: updated },
      domains:        selDomains,
      schoolsUpdated: updated,
      schools:        updatedSchools,
      failedSchools,
    })

  } catch (err) {
    logger.error(`JN baseline pull error: ${err.message}`)
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: { status: 'failed', completedAt: new Date().toISOString(), errorLog: JSON.stringify({ error: err.message }) }
    })
    return res.status(502).json({ error: 'Gagal menarik data JN baseline dari AI engine.' })
  }
}

// ── Fasa B: Pull Outsource → cipta IngestionRecord untuk semakan ─────────────
const _pullOutsource = async (req, res, source, schools, month, year) => {
  const schoolCodes = schools.map(s => s.schoolCode)
  const jnScores    = Object.fromEntries(schools.map(s => [s.schoolCode, s.jnAuditScore]))
  const jnDomainScores = await _latestJnDomainMap(schools)
  const now = new Date()

  const run = await prisma.ingestionRun.create({
    data: {
      sourceId:      source.id,
      runType:       'manual',
      runCategory:   'outsource',
      triggeredById: req.user.id,
      status:        'running',
    }
  })

  try {
    const aiResp = await axios.post(`${AI}/ai/ingest/api`, {
      source_code:      source.sourceCode,
      school_codes:     schoolCodes,
      jn_scores:        jnScores,
      jn_domain_scores: jnDomainScores,
      field_mappings:   safeParse(source.fieldMappings, {}),
      month:            month || now.getMonth() + 1,
      year:             year  || now.getFullYear(),
    }, { timeout: 120000 })

    const { records } = aiResp.data
    const pullDate = now.toISOString().slice(0, 10)
    let created = 0

    for (const rec of records) {
      if (rec.error) continue
      const school = schools.find(s => s.schoolCode === rec.school_code)

      await prisma.ingestionRecord.create({
        data: {
          runId:                     run.id,
          sourceId:                  source.id,
          schoolId:                  school?.id || null,
          schoolCodeRaw:             rec.school_code,
          dataType:                  rec.data_type || 'quantitative',
          jnAuditScore:              rec.jn_audit_score ?? null,
          extractedScores:           JSON.stringify(rec.extracted_scores || {}),
          mappedScores:              JSON.stringify(rec.mapped_scores || {}),
          compositeOperationalScore: rec.composite_operational_score ?? null,
          discrepancyIndex:          rec.discrepancy_index ?? null,
          diClassification:          rec.di_classification ?? null,
          domainDi:                  JSON.stringify(rec.domain_di || {}),
          agent0Confidence:          rec.agent0_confidence || 0,
          conversionMethod:          rec.conversion_method || 'direct',
          pullDate,
          status: 'pending',
        }
      })
      created++
    }

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status:         'completed',
        completedAt:    now.toISOString(),
        recordsCreated: created,
        summary:        JSON.stringify({ source: source.sourceCode, schools: schoolCodes.length, records: created }),
      }
    })

    logger.info(`Outsource pull complete: ${created} records from ${source.sourceCode}`)
    return res.json({
      runCategory: 'outsource',
      run:         { id: run.id, status: 'completed', recordsCreated: created },
      records:     created,
    })

  } catch (err) {
    logger.error(`Outsource pull error: ${err.message}`)
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: { status: 'failed', completedAt: new Date().toISOString(), errorLog: JSON.stringify({ error: err.message }) }
    })
    return res.status(502).json({ error: 'Gagal menarik data dari AI engine.' })
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// DOCUMENT UPLOAD — routes based on sourceCategory
// ═════════════════════════════════════════════════════════════════════════════

const uploadDocument = async (req, res) => {
  const { sourceId, schoolIds } = req.body

  if (!req.file) return res.status(400).json({ error: 'Fail diperlukan.' })
  const source = await prisma.dataSource.findUnique({ where: { id: sourceId } })
  if (!source) return res.status(404).json({ error: 'Sumber tidak dijumpai.' })

  const ids = schoolIds ? safeParse(schoolIds, []) : []
  const whereSchool = ids.length ? { id: { in: ids } } : {}
  const schools = await prisma.school.findMany({ where: whereSchool })

  if (source.sourceCategory === 'jn_baseline') {
    return _uploadJnBaselineDoc(req, res, source, schools)
  }
  return _uploadOutsourceDoc(req, res, source, schools)
}

// JN Baseline document → call /ai/ingest/jn-baseline → update School.jnAuditScore
const _uploadJnBaselineDoc = async (req, res, source, schools) => {
  const schoolCodes = schools.map(s => s.schoolCode)
  const now = new Date()

  const run = await prisma.ingestionRun.create({
    data: { sourceId: source.id, runType: 'manual', runCategory: 'jn_baseline', triggeredById: req.user.id, status: 'running' }
  })

  try {
    // Muat naik manual: hantar FAIL SEBENAR ke AI engine — Agent 0 parse
    // dokumen syor → skor per standard SKPM. (Laluan utama Pemeriksaan JN
    // ialah tarikan Google Drive melalui pullFromSource tanpa fail.)
    const form = new FormData()
    form.append('file', req.file.buffer, { filename: req.file.originalname, contentType: req.file.mimetype })
    form.append('school_codes', JSON.stringify(schoolCodes))

    const aiResp = await axios.post(`${AI}/ai/ingest/jn-document`, form, {
      headers: form.getHeaders(), timeout: 120000,
    })

    const { records } = aiResp.data
    let updated = 0
    const updatedSchools = []
    const failedSchools = []

    for (const rec of records) {
      if (rec.error || rec.jn_composite_score == null) {
        const school = schools.find(s => s.schoolCode === rec.school_code)
        failedSchools.push({
          schoolCode: rec.school_code,
          schoolName: school?.schoolName || rec.school_code,
          error:      rec.error || 'Tiada standard SKPM dapat dipetakan daripada dokumen ini.',
        })
        continue
      }
      const school = schools.find(s => s.schoolCode === rec.school_code)
      if (!school) continue

      const pullDate = rec.pull_date || now.toISOString().slice(0, 10)
      const composite = await _saveJnBaseline(school, rec, source.sourceCode, pullDate)
      updated++
      updatedSchools.push({
        schoolCode:   rec.school_code,
        schoolName:   school.schoolName,
        jnAuditScore: composite,
        partial:      rec.partial || false,
        domainScores: rec.domain_scores || rec.dimension_scores || {},
        sourceFile:   req.file.originalname,
        inspectionTheme: rec.inspection_theme || null,
      })
    }

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: 'completed', completedAt: now.toISOString(), recordsCreated: updated,
        summary: JSON.stringify({
          source: source.sourceCode, schoolsUpdated: updated, runCategory: 'jn_baseline', file: req.file.originalname,
          ...(failedSchools.length && { failed: failedSchools }),
        }),
      }
    })

    return res.json({
      runCategory: 'jn_baseline',
      run: { id: run.id, status: 'completed', recordsCreated: updated },
      schoolsUpdated: updated,
      schools: updatedSchools,
      failedSchools,
    })
  } catch (err) {
    logger.error(`JN baseline doc upload error: ${err.message}`)
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: { status: 'failed', completedAt: new Date().toISOString(), errorLog: JSON.stringify({ error: err.message }) }
    })
    return res.status(502).json({ error: 'Gagal memproses dokumen JN baseline.' })
  }
}

// Outsource document → Agent 0 → IngestionRecord
const _uploadOutsourceDoc = async (req, res, source, schools) => {
  const schoolCodes = schools.map(s => s.schoolCode)
  const jnScores    = JSON.stringify(Object.fromEntries(schools.map(s => [s.schoolCode, s.jnAuditScore])))
  const jnDomainScores = JSON.stringify(await _latestJnDomainMap(schools))

  const run = await prisma.ingestionRun.create({
    data: { sourceId: source.id, runType: 'manual', runCategory: 'outsource', triggeredById: req.user.id, status: 'running' }
  })

  try {
    const form = new FormData()
    form.append('file', req.file.buffer, { filename: req.file.originalname, contentType: req.file.mimetype })
    form.append('school_codes', JSON.stringify(schoolCodes))
    form.append('jn_scores', jnScores)
    form.append('jn_domain_scores', jnDomainScores)
    form.append('field_mappings', source.fieldMappings || '{}')
    form.append('source_system', source.sourceCode)

    const aiResp = await axios.post(`${AI}/ai/ingest/document`, form, {
      headers: form.getHeaders(), timeout: 120000
    })

    const { records } = aiResp.data
    const pullDate = new Date().toISOString().slice(0, 10)
    let created = 0

    for (const rec of records) {
      const school = schools.find(s => s.schoolCode === rec.school_code)
      await prisma.ingestionRecord.create({
        data: {
          runId: run.id, sourceId: source.id,
          schoolId: school?.id || null, schoolCodeRaw: rec.school_code,
          dataType: rec.data_type || 'mixed',
          jnAuditScore: rec.jn_audit_score ?? null,
          extractedScores: JSON.stringify(rec.extracted_scores || {}),
          mappedScores: JSON.stringify(rec.mapped_scores || {}),
          compositeOperationalScore: rec.composite_operational_score ?? null,
          discrepancyIndex: rec.discrepancy_index ?? null,
          diClassification: rec.di_classification ?? null,
          domainDi: JSON.stringify(rec.domain_di || {}),
          agent0Confidence: rec.agent0_confidence || 0,
          conversionMethod: rec.conversion_method || 'hybrid',
          qualitativeText: rec.qualitative_text || null,
          sourceFileName: req.file.originalname,
          pullDate, status: 'pending',
        }
      })
      created++
    }

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: { status: 'completed', completedAt: new Date().toISOString(), recordsCreated: created }
    })

    return res.json({
      runCategory: 'outsource',
      run: { id: run.id, status: 'completed', recordsCreated: created },
      records: created,
    })
  } catch (err) {
    logger.error(`Outsource doc upload error: ${err.message}`)
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: { status: 'failed', completedAt: new Date().toISOString(), errorLog: JSON.stringify({ error: err.message }) }
    })
    return res.status(502).json({ error: 'Gagal memproses dokumen.' })
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// RUNS & RECORDS
// ═════════════════════════════════════════════════════════════════════════════

const listRuns = async (req, res) => {
  const runs = await prisma.ingestionRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 50,
    include: { source: { select: { name: true, sourceCode: true } }, triggeredBy: { select: { name: true } } }
  })
  return res.json({ runs })
}

const getRun = async (req, res) => {
  const run = await prisma.ingestionRun.findUnique({
    where: { id: req.params.id },
    include: {
      source: true,
      triggeredBy: { select: { name: true } },
      records: { include: { school: { select: { schoolCode: true, schoolName: true, state: true } } } }
    }
  })
  if (!run) return res.status(404).json({ error: 'Run tidak dijumpai.' })
  return res.json({ run: { ...run, records: run.records.map(parseRecord) } })
}

const listRecords = async (req, res) => {
  const { status, sourceId, page = 1, limit = 20 } = req.query
  const where = {}
  if (status)   where.status   = status
  if (sourceId) where.sourceId = sourceId
  // IngestionRecord tiada pautan sektor terus — skop melalui pencetus run
  // (siapa yang menjalankan pull/upload berkenaan), selaras dengan corak
  // skop sektor lain (Case.submittedBy.sector).
  if (req.user.role === 'peneraju_sektor') {
    where.run = { triggeredBy: { sector: req.user.sector } }
  }

  const [records, total] = await Promise.all([
    prisma.ingestionRecord.findMany({
      where, orderBy: { createdAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      include: {
        school:     { select: { schoolCode: true, schoolName: true, state: true } },
        source:     { select: { name: true, sourceCode: true } },
        reviewedBy: { select: { name: true } },
      }
    }),
    prisma.ingestionRecord.count({ where })
  ])

  return res.json({ records: records.map(parseRecord), total, page: parseInt(page) })
}

// ═════════════════════════════════════════════════════════════════════════════
// APPROVE / REJECT
// ═════════════════════════════════════════════════════════════════════════════

const approveRecord = async (req, res) => {
  const record = await prisma.ingestionRecord.findUnique({
    where: { id: req.params.id },
    include: { school: true }
  })
  if (!record) return res.status(404).json({ error: 'Rekod tidak dijumpai.' })
  if (record.status !== 'pending') return res.status(400).json({ error: 'Rekod bukan dalam status pending.' })
  if (!record.school) return res.status(400).json({ error: 'Sekolah tidak dikenalpasti dalam rekod ini.' })

  const { incidentText } = req.body
  if (!incidentText || incidentText.length < 20) {
    return res.status(400).json({ error: 'incidentText (min 20 aksara) diperlukan untuk cipta kes.' })
  }

  const operationalScore = record.compositeOperationalScore
  if (operationalScore === null) return res.status(400).json({ error: 'Skor operasi tidak tersedia dalam rekod.' })

  // domain_di: perbandingan DUA belah (operasi vs audit JN) per domain SKPM,
  // dikira semasa mapping ingestion (mapping_engine.map_and_score) — hantar
  // ke Agent C supaya syor tindakan spesifik kepada domain yang benar-benar
  // bercanggah, bukan kenyataan generik.
  let domainDi = null
  try {
    const parsed = JSON.parse(record.domainDi || '{}')
    if (Object.keys(parsed).length) domainDi = parsed
  } catch { /* domainDi kekal null */ }

  // Run full AI pipeline
  let aiResult
  try {
    const aiResp = await axios.post(`${AI}/ai/pipeline`, {
      school_id:             record.school.schoolCode,
      school_name:           record.school.schoolName,
      operational_score:     operationalScore,
      jn_audit_score:        record.jnAuditScore ?? record.school.jnAuditScore,
      incident_text:         incidentText,
      integrity_risk_index:  record.school.integrityRiskIndex || 0,
      canteen_hygiene_score: record.school.canteenHygieneScore,
      last_audit_date:       record.school.lastAuditDate,
      emis_access_suspended: record.school.emissAccessSuspended,
      domain_di:             domainDi,
    }, { timeout: 60000 })
    aiResult = aiResp.data
  } catch (err) {
    return res.status(502).json({ error: 'AI engine tidak tersedia.' })
  }

  const { agent_a, agent_b, agent_c } = aiResult
  const generateCaseId = () => {
    const d = new Date()
    const yymm = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}`
    return `JN-${yymm}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
  }

  const newCase = await prisma.case.create({
    data: {
      caseId: generateCaseId(),
      schoolId: record.school.id,
      submittedById: req.user.id,
      operationalScore, jnAuditScore: agent_b.jn_audit_score_used,
      discrepancyIndex: agent_b.di_value, diClassification: agent_b.di_classification,
      alertLevel: agent_b.alert_level, anomalyDetected: agent_b.anomaly_detected,
      incidentText, category: agent_a.category, severity: agent_a.severity,
      agentAConfidence: agent_a.confidence, agentBConfidence: agent_b.confidence,
      riskFlags: JSON.stringify(agent_b.risk_flags), anomalyScore: agent_b.anomaly_score,
      payloadChecksum: agent_a.checksum, sourceSystem: record.source?.sourceCode || 'INGESTION',
      agentAOutput: JSON.stringify(agent_a), agentBOutput: JSON.stringify(agent_b),
    }
  })

  await prisma.executiveBrief.create({
    data: {
      caseId: newCase.id,
      enforcementActions: JSON.stringify(agent_c.enforcement_actions),
      policyRecommendations: JSON.stringify(agent_c.policy_recommendations),
      legalReferences: JSON.stringify(agent_c.legal_references),
      directiveText: agent_c.directive_text,
      ragSources: JSON.stringify(agent_c.rag_sources || []),
      llmModelUsed: agent_c.model_used, llmPromptHash: agent_c.prompt_hash,
    }
  })

  // Update record status
  await prisma.ingestionRecord.update({
    where: { id: record.id },
    data: {
      status: 'case_created', linkedCaseId: newCase.id,
      reviewedById: req.user.id, reviewedAt: new Date().toISOString(),
    }
  })

  logger.info(`Ingestion record approved → Case ${newCase.caseId}`)

  // Eskalasi ke Penyelaras JPN negeri (selepas syor Agent C sedia) — sama
  // seperti laluan submitCase manual (cases.controller.js).
  try {
    await escalateToStatePic({ caseRecord: newCase, directiveText: agent_c.directive_text, school: record.school })
  } catch (err) {
    logger.error(`Escalation error for ${newCase.caseId}: ${err.message}`)
  }
  return res.json({ message: 'Kes berjaya dicipta.', case: { id: newCase.id, caseId: newCase.caseId, alertLevel: newCase.alertLevel, discrepancyIndex: newCase.discrepancyIndex } })
}

const rejectRecord = async (req, res) => {
  const record = await prisma.ingestionRecord.findUnique({ where: { id: req.params.id } })
  if (!record) return res.status(404).json({ error: 'Rekod tidak dijumpai.' })

  await prisma.ingestionRecord.update({
    where: { id: req.params.id },
    data: {
      status: 'rejected',
      reviewedById: req.user.id,
      reviewedAt: new Date().toISOString(),
      reviewNotes: req.body.reason || 'Ditolak oleh pegawai.',
    }
  })
  return res.json({ message: 'Rekod ditolak.' })
}

// ═════════════════════════════════════════════════════════════════════════════
// SCHEDULED PULL (called by AI engine scheduler)
// ═════════════════════════════════════════════════════════════════════════════

const scheduledPull = async (req, res) => {
  const schedulerToken = process.env.SCHEDULER_SECRET || 'prestij25-scheduler-secret'
  if (req.headers['x-scheduler-token'] !== schedulerToken) {
    return res.status(401).json({ error: 'Tidak dibenarkan.' })
  }

  const { month, year } = req.body
  const sources = await prisma.dataSource.findMany({
    where: { isActive: true, pullSchedule: 'monthly' }
  })

  const results = []
  for (const source of sources) {
    if (source.sourceType !== 'api') continue
    const schools = await prisma.school.findMany({})
    const schoolCodes = schools.map(s => s.schoolCode)
    const jnScores = Object.fromEntries(schools.map(s => [s.schoolCode, s.jnAuditScore]))
    const jnDomainScores = await _latestJnDomainMap(schools)

    try {
      const run = await prisma.ingestionRun.create({
        data: { sourceId: source.id, runType: 'scheduled', runCategory: 'outsource', status: 'running' }
      })
      const aiResp = await axios.post(`${AI}/ai/ingest/api`, {
        source_code: source.sourceCode, school_codes: schoolCodes,
        jn_scores: jnScores, jn_domain_scores: jnDomainScores,
        field_mappings: safeParse(source.fieldMappings, {}),
        month, year,
      }, { timeout: 120000 })

      const { records } = aiResp.data
      const pullDate = new Date().toISOString().slice(0, 10)
      let created = 0

      for (const rec of records) {
        if (rec.error) continue
        const school = schools.find(s => s.schoolCode === rec.school_code)
        await prisma.ingestionRecord.create({
          data: {
            runId: run.id, sourceId: source.id,
            schoolId: school?.id || null, schoolCodeRaw: rec.school_code,
            dataType: rec.data_type || 'quantitative',
            jnAuditScore: rec.jn_audit_score ?? null,
            extractedScores: JSON.stringify(rec.extracted_scores || {}),
            mappedScores: JSON.stringify(rec.mapped_scores || {}),
            compositeOperationalScore: rec.composite_operational_score ?? null,
            discrepancyIndex: rec.discrepancy_index ?? null,
            diClassification: rec.di_classification ?? null,
            domainDi: JSON.stringify(rec.domain_di || {}),
            agent0Confidence: rec.agent0_confidence || 0,
            conversionMethod: 'direct', pullDate, status: 'pending',
          }
        })
        created++
      }

      await prisma.ingestionRun.update({
        where: { id: run.id },
        data: { status: 'completed', completedAt: new Date().toISOString(), recordsCreated: created }
      })
      results.push({ source: source.sourceCode, records: created })
    } catch (e) {
      results.push({ source: source.sourceCode, error: e.message })
    }
  }

  return res.json({ message: 'Scheduled pull complete', results })
}

// ═════════════════════════════════════════════════════════════════════════════
// GDRIVE FILE LISTING (Pemeriksaan JN — file browser)
// ═════════════════════════════════════════════════════════════════════════════

const listGdriveFiles = async (req, res) => {
  const { year } = req.query
  try {
    const aiResp = await axios.get(`${AI}/ai/gdrive/files`, {
      params: { year: year || undefined },
      timeout: 30000,
    })
    return res.json(aiResp.data)
  } catch (err) {
    logger.error(`GDrive file listing error: ${err.message}`)
    return res.status(502).json({ error: 'Gagal menyenaraikan fail Google Drive.' })
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// MAPPING PREVIEW (Fasa B)
// ═════════════════════════════════════════════════════════════════════════════

const mappingPreview = async (req, res) => {
  const { sourceCode, schoolCodes } = req.body
  const codes = Array.isArray(schoolCodes) ? schoolCodes : (schoolCodes ? [schoolCodes] : [])
  if (!sourceCode || !codes.length) {
    return res.status(400).json({ error: 'sourceCode dan schoolCodes diperlukan.' })
  }

  // Dapatkan JN domain scores terkini dari DB
  const schools = await prisma.school.findMany({
    where: { schoolCode: { in: codes } },
    select: { id: true, schoolCode: true, schoolName: true },
  })
  const jnRows = await prisma.jnDomainScore.findMany({
    where: { schoolId: { in: schools.map(s => s.id) } },
    orderBy: [{ auditPeriod: 'desc' }, { updatedAt: 'desc' }],
  })
  const jnDomainScores = {}
  for (const row of jnRows) {
    const code = schools.find(s => s.id === row.schoolId)?.schoolCode
    if (!code) continue
    if (!jnDomainScores[code]) jnDomainScores[code] = {}
    if (jnDomainScores[code][row.domain] === undefined) {
      jnDomainScores[code][row.domain] = row.domainScore
    }
  }

  try {
    const aiResp = await axios.post(`${AI}/ai/ingest/mapping-preview`, {
      source_code: sourceCode,
      school_codes: codes,
      jn_domain_scores: jnDomainScores,
    }, { timeout: 15000 })
    return res.json(aiResp.data)
  } catch (err) {
    logger.error(`Mapping preview error: ${err.message}`)
    return res.status(502).json({ error: 'Gagal mendapatkan mapping preview.' })
  }
}

module.exports = {
  listSources, createSource, updateSource, deleteSource,
  pullFromSource, uploadDocument,
  listRuns, getRun, listRecords,
  approveRecord, rejectRecord,
  scheduledPull,
  listGdriveFiles,
  mappingPreview,
}
