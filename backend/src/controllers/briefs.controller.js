const prisma = require('../utils/prisma')

const listBriefs = async (req, res) => {
  const where = {}
  if (req.user.role === 'peneraju_sektor') {
    where.case = { submittedBy: { sector: req.user.sector } }
  }
  const briefs = await prisma.executiveBrief.findMany({
    where,
    include: {
      case: {
        select: { id: true, caseId: true, diClassification: true, alertLevel: true, school: { select: { schoolCode: true, schoolName: true, state: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  return res.json({ briefs })
}

const getBrief = async (req, res) => {
  const brief = await prisma.executiveBrief.findUnique({
    where: { caseId: req.params.caseId },
    include: {
      case: { include: { school: true, submittedBy: { select: { name: true, sector: true } } } },
      reviewedBy: { select: { name: true, email: true } },
    },
  })
  if (!brief) return res.status(404).json({ error: 'Brief tidak dijumpai.' })
  // Tutup akses ID-terus di luar sektor (route sudah sekat penyelaras_jpn/
  // penganalisis_data sepenuhnya — di sini hanya perlu semak sektor sendiri).
  if (req.user.role === 'peneraju_sektor' && brief.case.submittedBy?.sector !== req.user.sector) {
    return res.status(403).json({ error: 'Anda tidak mempunyai kebenaran untuk melihat brief ini.' })
  }
  return res.json({ brief })
}

const signBrief = async (req, res) => {
  const { signType } = req.body // 'ketua_jn' | 'audit_director'
  if (!['ketua_jn', 'audit_director'].includes(signType)) {
    return res.status(400).json({ error: 'signType tidak sah.' })
  }

  const brief = await prisma.executiveBrief.findUnique({ where: { caseId: req.params.caseId } })
  if (!brief) return res.status(404).json({ error: 'Brief tidak dijumpai.' })

  const updateData = {
    reviewedById: req.user.id,
    reviewedAt: new Date(),
    ...(signType === 'ketua_jn' && { signedByKetuaJn: true }),
    ...(signType === 'audit_director' && { signedByAuditDirector: true }),
  }

  const updated = await prisma.executiveBrief.update({
    where: { caseId: req.params.caseId },
    data: updateData,
  })

  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: 'SIGN_BRIEF',
      resourceType: 'executive_briefs',
      resourceId: brief.id,
      details: JSON.stringify({ signType }),
    },
  })

  return res.json({ brief: updated })
}

// Tandatangan pukal — Pengurusan Atasan boleh tandatangan banyak brief
// sekaligus (cth. selepas semak beberapa kes GREEN/BLUE serentak) tanpa perlu
// buka setiap satu secara berasingan. Brief yang sudah ditandatangani untuk
// signType berkenaan dilangkau senyap (bukan ralat) supaya operasi pukal
// selamat diulang ke atas pilihan yang bertindih.
const bulkSignBriefs = async (req, res) => {
  const { caseIds, signType } = req.body
  if (!['ketua_jn', 'audit_director'].includes(signType)) {
    return res.status(400).json({ error: 'signType tidak sah.' })
  }
  if (!Array.isArray(caseIds) || caseIds.length === 0) {
    return res.status(400).json({ error: 'caseIds diperlukan (senarai tidak kosong).' })
  }

  const signedField = signType === 'ketua_jn' ? 'signedByKetuaJn' : 'signedByAuditDirector'
  const briefs = await prisma.executiveBrief.findMany({ where: { caseId: { in: caseIds } } })

  const toSign = briefs.filter((b) => !b[signedField])
  const alreadySigned = briefs.length - toSign.length
  const notFound = caseIds.length - briefs.length

  if (toSign.length > 0) {
    await prisma.executiveBrief.updateMany({
      where: { id: { in: toSign.map((b) => b.id) } },
      data: {
        reviewedById: req.user.id,
        reviewedAt: new Date(),
        [signedField]: true,
      },
    })

    await prisma.auditLog.createMany({
      data: toSign.map((b) => ({
        userId: req.user.id, action: 'SIGN_BRIEF', resourceType: 'executive_briefs',
        resourceId: b.id, details: JSON.stringify({ signType, bulk: true }),
      })),
    })
  }

  return res.json({ signed: toSign.length, alreadySigned, notFound, total: caseIds.length })
}

module.exports = { listBriefs, getBrief, signBrief, bulkSignBriefs }
