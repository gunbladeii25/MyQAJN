const prisma = require('../utils/prisma')

const listSchools = async (req, res) => {
  const { state, schoolType, search, page = 1, limit = 50 } = req.query
  const skip = (parseInt(page) - 1) * parseInt(limit)
  const where = {}
  if (state) where.state = state
  if (schoolType) where.schoolType = schoolType
  if (search) where.OR = [
    { schoolName: { contains: search } },
    { schoolCode: { contains: search } },
  ]

  const [schools, total] = await Promise.all([
    prisma.school.findMany({
      where, skip, take: parseInt(limit), orderBy: { schoolCode: 'asc' },
      include: {
        jnDomainScores: {
          orderBy: [{ auditPeriod: 'desc' }, { updatedAt: 'desc' }],
          select: { domain: true, domainLabel: true, domainScore: true, auditPeriod: true },
        },
      },
    }),
    prisma.school.count({ where }),
  ])

  // Pecahan per standard SKPM: nilai TERKINI per domain (tempoh terbaru menang) —
  // komponen jnAuditScore sekolah, dipaparkan dalam school picker.
  const withBreakdown = schools.map(({ jnDomainScores, ...s }) => {
    const seen = new Set()
    const jnDomainBreakdown = jnDomainScores.filter(d => {
      if (seen.has(d.domain)) return false
      seen.add(d.domain)
      return true
    })
    return { ...s, jnDomainBreakdown }
  })

  return res.json({ schools: withBreakdown, total })
}

const getSchool = async (req, res) => {
  const school = await prisma.school.findUnique({
    where: { id: req.params.id },
    include: {
      jnDomainScores: {
        orderBy: [{ auditPeriod: 'desc' }, { domain: 'asc' }],
      },
    },
  })
  if (!school) return res.status(404).json({ error: 'Sekolah tidak dijumpai.' })

  const parseAspects = (s) => { try { return JSON.parse(s) } catch { return {} } }
  const jnDomainScores = school.jnDomainScores.map(d => ({
    ...d,
    aspectScores: parseAspects(d.aspectScores),
  }))
  // Pecahan domain untuk tempoh audit terkini sahaja (paparan utama);
  // senarai penuh dikekalkan untuk trend antara tempoh.
  const latestPeriod = jnDomainScores[0]?.auditPeriod || null
  return res.json({
    school: {
      ...school,
      jnDomainScores,
      jnDomainBreakdown: jnDomainScores.filter(d => d.auditPeriod === latestPeriod),
    },
  })
}

const createSchool = async (req, res) => {
  const { schoolCode, schoolName, schoolType, state, district, jnAuditScore, lastAuditDate, integrityRiskIndex, canteenHygieneScore } = req.body
  if (!schoolCode || !schoolName || !schoolType) {
    return res.status(400).json({ error: 'Kod, nama, dan jenis sekolah diperlukan.' })
  }
  const existing = await prisma.school.findUnique({ where: { schoolCode } })
  if (existing) return res.status(409).json({ error: 'Kod sekolah telah wujud.' })

  const school = await prisma.school.create({
    data: {
      schoolCode, schoolName, schoolType, state, district,
      jnAuditScore: jnAuditScore ? parseFloat(jnAuditScore) : null,
      lastAuditDate: lastAuditDate || null,
      integrityRiskIndex: parseFloat(integrityRiskIndex || 0),
      canteenHygieneScore: canteenHygieneScore ? parseFloat(canteenHygieneScore) : null,
    },
  })
  return res.status(201).json({ school })
}

const updateSchool = async (req, res) => {
  const school = await prisma.school.findUnique({ where: { id: req.params.id } })
  if (!school) return res.status(404).json({ error: 'Sekolah tidak dijumpai.' })

  const updated = await prisma.school.update({
    where: { id: req.params.id },
    data: {
      ...req.body,
      jnAuditScore: req.body.jnAuditScore ? parseFloat(req.body.jnAuditScore) : school.jnAuditScore,
      integrityRiskIndex: req.body.integrityRiskIndex ? parseFloat(req.body.integrityRiskIndex) : school.integrityRiskIndex,
    },
  })
  return res.json({ school: updated })
}

module.exports = { listSchools, getSchool, createSchool, updateSchool }
