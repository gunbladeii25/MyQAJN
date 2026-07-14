const prisma = require('./prisma')
const logger = require('./logger')
const { sendMail } = require('./mailer')
const { renderEmail, infoRow, infoCard, calloutBox } = require('./emailTemplate')

// Warna aksen e-mel ikut tahap amaran — sepadan dengan ALERT_COLORS di FE
// (constants/index.js) supaya isyarat visual konsisten merentas sistem.
const ALERT_ACCENT = { RED: '#dc2626', ORANGE: '#ea580c', YELLOW: '#ca8a04', BLUE: '#2563eb', GREEN: '#16a34a' }

// Eskalasi kes baharu (selepas Agent C jana syor) kepada Penyelaras JPN
// peringkat NEGERI tempat sekolah berkenaan berada — BUKAN ke PIC sekolah.
// Dengan ~10k sekolah dalam sistem, notifikasi terus ke setiap sekolah tidak
// berskala; sebaliknya kes dilaporkan kepada salah seorang daripada ~16
// Penyelaras JPN (satu per negeri) untuk makluman dan respons rasmi negeri
// terhadap syor tindakan.
//
// Dipanggil daripada DUA titik penciptaan kes (submitCase manual, dan
// approveRecord selepas kelulusan rekod ingestion) — kedua-duanya menghasilkan
// Case + ExecutiveBrief (output Agent C) yang serupa.
const escalateToStatePic = async ({ caseRecord, directiveText, school }) => {
  if (!school.state) {
    logger.warn(`Case ${caseRecord.caseId}: sekolah ${school.schoolCode} tiada rekod negeri — eskalasi dilangkau.`)
    await prisma.caseEscalation.create({
      data: {
        caseId: caseRecord.id, state: 'TIDAK DIKETAHUI', userId: null,
        emailStatus: 'skipped', emailError: 'Sekolah tiada rekod negeri (School.state kosong)',
      },
    })
    return
  }

  const pics = await prisma.user.findMany({
    where: { role: 'penyelaras_jpn', state: school.state, isActive: true },
  })

  if (pics.length === 0) {
    logger.warn(`Case ${caseRecord.caseId}: tiada Penyelaras JPN aktif berdaftar untuk negeri ${school.state}.`)
    await prisma.caseEscalation.create({
      data: {
        caseId: caseRecord.id, state: school.state, userId: null,
        emailStatus: 'skipped', emailError: `Tiada Penyelaras JPN didaftarkan untuk negeri ${school.state}`,
      },
    })
    return
  }

  for (const pic of pics) {
    const escalation = await prisma.caseEscalation.create({
      data: { caseId: caseRecord.id, state: school.state, userId: pic.id, emailStatus: 'pending' },
    })
    await _sendEscalationEmail({ escalationId: escalation.id, caseRecord, directiveText, school, pic })
  }

  logger.info(`Case ${caseRecord.caseId} dieskalasi ke ${pics.length} Penyelaras JPN (negeri: ${school.state})`)
}

// Hantar (atau hantar semula) e-mel eskalasi bagi SATU baris CaseEscalation
// sedia ada — dikongsi antara aliran automatik (escalateToStatePic) dan
// CRUD manual admin (cases.controller.createEscalation/resendEscalation).
const _sendEscalationEmail = async ({ escalationId, caseRecord, directiveText, school, pic }) => {
  try {
    const result = await sendMail({
      to: pic.email,
      subject: `🔔 Kes Baharu ${caseRecord.caseId} — ${school.schoolName} (${caseRecord.alertLevel})`,
      html: _buildEmailHtml({ caseRecord, directiveText, school, pic }),
    })
    await prisma.caseEscalation.update({
      where: { id: escalationId },
      data: { emailStatus: result.sent ? 'sent' : 'skipped', emailError: null },
    })
  } catch (err) {
    logger.error(`Gagal hantar e-mel eskalasi ke ${pic.email} (case ${caseRecord.caseId}): ${err.message}`)
    await prisma.caseEscalation.update({
      where: { id: escalationId },
      data: { emailStatus: 'failed', emailError: err.message },
    })
  }
}

const _escapeHtml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Terima item senarai dalam pelbagai bentuk yang dijana LLM (bentuk JSON
// Ollama TIDAK konsisten antara panggilan — {id, arahan}, {flag, legal,
// action}, {domain_skpm, tindakan: [...]} (bersarang), {nama_undang_undang,
// pasal}, dll.) — kembalikan teks paparan tunggal, rekursif supaya senarai
// tindakan bersarang (cth. "tindakan") tidak hilang senyap. Sepadan dengan
// toStr() di CaseDetailPage.jsx frontend.
const _itemToText = (item) => {
  if (item === null || item === undefined) return ''
  if (typeof item === 'string') return item
  if (Array.isArray(item)) return item.map(_itemToText).filter(Boolean).join('; ')
  if (typeof item === 'object') {
    if (item.action) return _itemToText(item.action)
    if (item.arahan) return _itemToText(item.arahan)
    if (item.pasal) return item.nama_undang_undang ? `${item.nama_undang_undang} — ${item.pasal}` : item.pasal
    const title = item.domain_skpm || item.standard_skpm || item.flag || item.label
    const body = item.tindakan || item.tindakan_khusus || item.details
    if (title && body) return `${title}: ${_itemToText(body)}`
    if (title) return title
    return Object.values(item).map(_itemToText).filter(Boolean).join(' — ')
  }
  return String(item)
}

const _list = (arr) => Array.isArray(arr) ? arr : (arr ? [arr] : [])

// Agent C direktif disimpan sebagai JSON string (tajuk_kes, ringkasan_eksekutif,
// penemuan_utama[], konteks_undang_undang, arahan_khusus, tempoh_tindakan,
// nota_penutup) — paparkan sebagai HTML terstruktur, bukan JSON mentah. Bentuk
// medan berbeza sedikit antara templat statik fallback dan output LLM Ollama
// (cth. konteks_undang_undang & arahan_khusus boleh jadi string ATAU senarai),
// jadi setiap medan senarai dinormalkan melalui _list()/_itemToText().
const _formatDirective = (directiveText) => {
  let d
  try {
    d = typeof directiveText === 'object' ? directiveText : JSON.parse(directiveText)
  } catch {
    return `<div style="white-space:pre-wrap;">${_escapeHtml(directiveText)}</div>`
  }

  const toUl = (items) => items.length
    ? `<ul style="margin:10px 0 0;padding-left:18px;">${items.map((i) => `<li style="margin-bottom:4px;">${_escapeHtml(_itemToText(i))}</li>`).join('')}</ul>`
    : ''

  const findings = toUl(_list(d.penemuan_utama))
  const arahan = toUl(_list(d.arahan_khusus))
  const konteks = _list(d.konteks_undang_undang).map(_itemToText).filter(Boolean).join('; ')

  // ringkasan_eksekutif/tempoh_tindakan/nota_penutup MESTI juga melalui
  // _itemToText — Ollama kadangkala hantar array/objek untuk medan yang
  // sepatutnya rentetan tunggal (cth. tempoh_tindakan sebagai senarai
  // {id, tempoh} bukan string), yang jika escape terus akan cetak
  // "[object Object]" (String(obj) mentah).
  const ringkasan = _itemToText(d.ringkasan_eksekutif)
  const tempoh = _itemToText(d.tempoh_tindakan)
  const nota = _itemToText(d.nota_penutup)

  return [
    ringkasan ? `<p style="margin:0 0 10px;">${_escapeHtml(ringkasan)}</p>` : '',
    findings ? `<p style="margin:14px 0 0;font-weight:700;color:#0f172a;">Penemuan Utama</p>${findings}` : '',
    arahan ? `<p style="margin:14px 0 0;font-weight:700;color:#0f172a;">Arahan Khusus</p>${arahan}` : '',
    konteks ? `<p style="margin:14px 0 0;font-size:12.5px;color:#64748b;"><strong>Konteks Undang-Undang:</strong> ${_escapeHtml(konteks)}</p>` : '',
    tempoh ? `<p style="margin:8px 0 0;font-size:12.5px;color:#64748b;"><strong>Tempoh Tindakan:</strong> ${_escapeHtml(tempoh)}</p>` : '',
    nota ? `<p style="margin:14px 0 0;font-size:12px;color:#94a3b8;font-style:italic;">${_escapeHtml(nota)}</p>` : '',
  ].filter(Boolean).join('')
}

const _buildEmailHtml = ({ caseRecord, directiveText, school, pic }) => {
  const link = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/cases/${caseRecord.id}`
  const accent = ALERT_ACCENT[caseRecord.alertLevel] || ALERT_ACCENT.BLUE

  const infoRows = infoCard([
    infoRow('Sekolah', `${school.schoolName} (${school.schoolCode})`),
    infoRow('Negeri', school.state),
    infoRow('Tahap Amaran', caseRecord.alertLevel, accent),
    infoRow('Discrepancy Index', Number(caseRecord.discrepancyIndex).toFixed(4)),
    infoRow('Klasifikasi', caseRecord.diClassification),
  ].join(''))

  return renderEmail({
    preheader: `Kes ${caseRecord.caseId} di ${school.schoolName} memerlukan respons rasmi negeri anda.`,
    eyebrow: `Tahap Amaran: ${caseRecord.alertLevel}`,
    heading: `Kes Baharu Memerlukan Tindakan — ${caseRecord.caseId}`,
    accentColor: accent,
    bodyHtml: `
      <p style="margin:0 0 14px;">Salam sejahtera <strong>${pic.name}</strong> (Penyelaras JPN ${school.state}),</p>
      <p style="margin:0 0 6px;">Satu kes discrepancy index (DI) telah dikesan bagi sekolah di bawah kelolaan negeri anda:</p>
      ${infoRows}
      <p style="margin:20px 0 6px;font-weight:700;color:#0f172a;">📋 Syor Tindakan</p>
      ${calloutBox(_formatDirective(directiveText), accent)}
      <p style="margin:18px 0 0;">Sila log masuk ke sistem MyQA@JN untuk menyemak kes penuh dan memberikan respons rasmi negeri terhadap syor di atas.</p>
    `,
    ctaText: 'Lihat Kes & Beri Respons',
    ctaUrl: link,
  })
}

module.exports = { escalateToStatePic, sendEscalationEmail: _sendEscalationEmail }
