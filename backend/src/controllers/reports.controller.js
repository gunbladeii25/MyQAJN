const prisma = require('../utils/prisma')

// Skop pertanyaan kes mengikut peranan — dikongsi oleh dashboard & di-trend
// supaya kedua-dua laporan sentiasa konsisten dengan skop di cases.controller.js
// (peneraju_sektor → sektor sendiri; penyelaras_jpn → kes dieskalasi ke negeri
// mereka sahaja). Tanpa ini, Penyelaras JPN yang mencapai Dashboard terus akan
// nampak data KES SELURUH NEGARA, bukan sekadar negeri mereka.
const _scopedCaseWhere = (user) => {
  if (user.role === 'peneraju_sektor') return { submittedBy: { sector: user.sector } }
  if (user.role === 'penyelaras_jpn')  return { escalations: { some: { userId: user.id } } }
  return {}
}

const dashboard = async (req, res) => {
  const where = _scopedCaseWhere(req.user)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [totalCases, todayCases, redAlerts, pendingReview, briefsPendingSign, recentCases, byAlert, byStatus] = await Promise.all([
    prisma.case.count({ where }),
    prisma.case.count({ where: { ...where, createdAt: { gte: today } } }),
    prisma.case.count({ where: { ...where, alertLevel: 'RED' } }),
    prisma.case.count({ where: { ...where, status: 'pending' } }),
    prisma.executiveBrief.count({
      where: {
        signedByKetuaJn: false,
        signedByAuditDirector: false,
        case: Object.keys(where).length ? where : undefined,
      },
    }),
    prisma.case.findMany({
      where,
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { school: { select: { schoolCode: true, schoolName: true, state: true } } },
    }),
    prisma.case.groupBy({ by: ['alertLevel'], where, _count: true }),
    prisma.case.groupBy({ by: ['status'],     where, _count: true }),
  ])

  return res.json({ totalCases, todayCases, redAlerts, pendingReview, briefsPendingSign, recentCases, byAlert, byStatus })
}

const diTrend = async (req, res) => {
  const { days = 30 } = req.query
  const since = new Date()
  since.setDate(since.getDate() - parseInt(days))

  const where = { createdAt: { gte: since }, ..._scopedCaseWhere(req.user) }

  const cases = await prisma.case.findMany({
    where,
    select: { createdAt: true, discrepancyIndex: true, alertLevel: true },
    orderBy: { createdAt: 'asc' },
  })

  return res.json({ trend: cases })
}

const bySector = async (req, res) => {
  const results = await prisma.case.groupBy({
    by: ['alertLevel'],
    _count: true,
    orderBy: { _count: { alertLevel: 'desc' } },
  })
  return res.json({ bySector: results })
}

module.exports = { dashboard, diTrend, bySector }
