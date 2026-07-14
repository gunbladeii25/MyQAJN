// Bina e-mel HTML bermodel (branded) — reka bentuk konsisten untuk SEMUA
// e-mel transaksi sistem (reset kata laluan, eskalasi kes, dll.).
//
// Guna table-based layout + inline styles sepenuhnya, BUKAN kerana citarasa
// lama — kerana klien e-mel (Outlook desktop terutamanya) tidak menyokong
// flexbox/grid/external CSS. Ini ialah amalan standard industri untuk e-mel
// HTML yang perlu render konsisten merentas Gmail/Outlook/Apple Mail.
//
// Logo dipautkan sebagai URL luaran (bukan data URI/lampiran) — jauh lebih
// ringan daripada membenamkan fail raster (cth. KPMJN-Hitam.png ~1.1MB) terus
// ke dalam setiap e-mel transaksi. Boleh override melalui EMAIL_LOGO_URL
// (.env) tanpa perlu ubah kod apabila logo rasmi sedia untuk dihoskan.
const LOGO_URL = process.env.EMAIL_LOGO_URL
  || 'https://images.unsplash.com/photo-1783902903805-977169322c1e?q=80&w=1116&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'

const BRAND = {
  primary: '#1e3a8a',
  primaryDark: '#111827',
  accent: '#2563eb',
  bg: '#eef2f7',
  cardBg: '#ffffff',
  border: '#e2e8f0',
  textMuted: '#64748b',
}

/**
 * @param {object} opts
 * @param {string} opts.preheader - teks pratonton tersembunyi (baris preview inbox)
 * @param {string} [opts.eyebrow] - label kecil di atas tajuk (cth. "TINDAKAN DIPERLUKAN")
 * @param {string} opts.heading - tajuk utama e-mel
 * @param {string} opts.bodyHtml - kandungan badan (HTML — perenggan, senarai, dll.)
 * @param {string} [opts.ctaText] - teks butang CTA (jika ada)
 * @param {string} [opts.ctaUrl] - pautan butang CTA
 * @param {string} [opts.accentColor] - warna aksen tema (lalai biru; escalation guna oren/merah ikut tahap amaran)
 */
function renderEmail({ preheader = '', eyebrow, heading, bodyHtml, ctaText, ctaUrl, accentColor }) {
  const accent = accentColor || BRAND.accent
  return `<!doctype html>
<html lang="ms">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preheader}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

          <!-- Header banner -->
          <tr>
            <td style="background:${BRAND.primary};border-radius:16px 16px 0 0;padding:26px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table;vertical-align:middle;">
                      <tr>
                        <td width="36" height="36" style="width:36px;height:36px;background:rgba(255,255,255,0.16);border-radius:9px;vertical-align:middle;text-align:center;">
                          <img src="${LOGO_URL}" width="36" height="36" alt="MyQA@JN"
                            style="display:block;width:36px;height:36px;border-radius:9px;object-fit:cover;border:0;outline:none;" />
                        </td>
                        <td style="vertical-align:middle;padding-left:10px;">
                          <span style="color:#fff;font-size:17px;font-weight:700;white-space:nowrap;">MyQA@JN</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align:middle;color:rgba(255,255,255,0.65);font-size:11px;">
                    Kementerian Pendidikan Malaysia
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Accent strip -->
          <tr><td style="background:${accent};height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>

          <!-- Card body -->
          <tr>
            <td style="background:${BRAND.cardBg};padding:36px 32px;border-left:1px solid ${BRAND.border};border-right:1px solid ${BRAND.border};">
              ${eyebrow ? `<p style="margin:0 0 8px;font-size:11.5px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:${accent};">${eyebrow}</p>` : ''}
              <h1 style="margin:0 0 18px;font-size:21px;font-weight:800;color:#0f172a;line-height:1.3;">${heading}</h1>
              <div style="font-size:14px;line-height:1.75;color:#334155;">${bodyHtml}</div>
              ${ctaText && ctaUrl ? `
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 4px;">
                <tr><td style="border-radius:10px;background:${accent};">
                  <a href="${ctaUrl}" style="display:inline-block;padding:13px 30px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${ctaText}</a>
                </td></tr>
              </table>
              <p style="margin:10px 0 0;font-size:11.5px;color:${BRAND.textMuted};word-break:break-all;">
                Jika butang tidak berfungsi, salin pautan ini: <a href="${ctaUrl}" style="color:${accent};">${ctaUrl}</a>
              </p>` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-radius:0 0 16px 16px;padding:18px 32px;border:1px solid ${BRAND.border};border-top:none;text-align:center;">
              <p style="margin:0;font-size:11.5px;color:${BRAND.textMuted};">
                E-mel ini dijana secara automatik oleh sistem MyQA@JN. Jangan balas terus ke e-mel ini.
              </p>
              <p style="margin:6px 0 0;font-size:11px;color:#94a3b8;">
                © 2026 Kementerian Pendidikan Malaysia · MyQA@JN — AI-Powered School QA Resolution Agent
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// Kotak maklumat ringkas (label/value) — untuk butiran kes/skor dalam e-mel,
// gantikan <table> lama yang kurang bergaya.
function infoRow(label, value, valueColor) {
  return `
    <tr>
      <td style="padding:9px 0;border-bottom:1px solid #f1f5f9;font-size:12.5px;color:#64748b;width:42%;">${label}</td>
      <td style="padding:9px 0;border-bottom:1px solid #f1f5f9;font-size:13.5px;font-weight:700;color:${valueColor || '#0f172a'};">${value}</td>
    </tr>`
}

function infoCard(rowsHtml) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:4px 16px;margin:18px 0;">
      ${rowsHtml}
    </table>`
}

// Kotak petikan (syor/directive/amaran) — gantikan <p style="background:#f9fafb"> lama.
function calloutBox(html, accent) {
  return `
    <div style="background:#f8fafc;border-left:3px solid ${accent || BRAND.accent};border-radius:0 8px 8px 0;padding:14px 18px;margin:18px 0;font-size:13.5px;color:#334155;white-space:pre-wrap;">
      ${html}
    </div>`
}

module.exports = { renderEmail, infoRow, infoCard, calloutBox, BRAND }
