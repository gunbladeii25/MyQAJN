const nodemailer = require('nodemailer')
const logger = require('./logger')

// SMTP_HOST kosong → mod log-sahaja (dev/demo), konsisten dengan corak
// "endpoint belum dikonfigurasi" yang digunakan di tempat lain dalam sistem
// (cth. Tindakan Segera / integrasi sistem luar).
const SMTP_HOST = process.env.SMTP_HOST || ''
const SMTP_FROM = process.env.SMTP_FROM || 'MyQA@JN <no-reply@myqajn.my>'

let transporter = null
if (SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  })
}

// Returns { sent: boolean } — tidak throw bila SMTP tidak dikonfigurasi (log
// sahaja); throw hanya bila SMTP DIKONFIGURASI tetapi penghantaran gagal,
// supaya caller boleh rekod emailStatus='failed' dengan sebab sebenar.
const sendMail = async ({ to, subject, html }) => {
  if (!transporter) {
    // Dev/demo: tiada SMTP disambung, jadi log pautan tindakan (jika ada)
    // supaya boleh diuji tanpa perlu inbox e-mel sebenar.
    const linkMatch = /href="([^"]+)"/.exec(html || '')
    logger.info(`[MAIL:LOG-ONLY] Ke: ${to} | Subjek: ${subject}${linkMatch ? ` | Pautan: ${linkMatch[1]}` : ''} (SMTP_HOST belum dikonfigurasi dalam .env)`)
    return { sent: false, logOnly: true }
  }
  await transporter.sendMail({ from: SMTP_FROM, to, subject, html })
  return { sent: true }
}

module.exports = { sendMail }
