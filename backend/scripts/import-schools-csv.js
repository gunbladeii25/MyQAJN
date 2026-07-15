// One-off, idempotent import of the real government school directory
// (backend/data/senarai_sekolah.csv, ~10,251 rows) into the `schools` table.
// Not part of prisma/seed.js on purpose — seed.js is dev/test fixtures and
// shouldn't become CSV-dependent or slow. Safe to re-run: upserts by
// schoolCode, so it never touches the handful of pre-existing seed schools
// (different code format) and just refreshes directory fields on re-run.
//
// Run with: npm run db:import-schools

const fs = require('fs')
const path = require('path')
const { parse } = require('csv-parse/sync')
const prisma = require('../src/utils/prisma')

const CSV_PATH = path.join(__dirname, '..', 'data', 'senarai_sekolah.csv')

// Verified 1:1 against MALAYSIA_STATES in frontend/src/constants/index.js —
// escalation routing (CaseEscalation → penyelaras_jpn.state) depends on
// School.state matching that exact casing/naming.
const NEGERI_TO_STATE = {
  'JOHOR': 'Johor',
  'KEDAH': 'Kedah',
  'KELANTAN': 'Kelantan',
  'MELAKA': 'Melaka',
  'NEGERI SEMBILAN': 'Negeri Sembilan',
  'PAHANG': 'Pahang',
  'PERAK': 'Perak',
  'PERLIS': 'Perlis',
  'PULAU PINANG': 'Pulau Pinang',
  'SABAH': 'Sabah',
  'SARAWAK': 'Sarawak',
  'SELANGOR': 'Selangor',
  'TERENGGANU': 'Terengganu',
  'WP KUALA LUMPUR': 'Kuala Lumpur',
  'WP LABUAN': 'Labuan',
  'WP PUTRAJAYA': 'Putrajaya',
}

const CHUNK_SIZE = 200

function toSchoolRow(record) {
  const negeri = (record['NEGERI'] || '').trim().toUpperCase()
  const state = NEGERI_TO_STATE[negeri] || null

  const ppd = (record['PPD'] || '').trim()
  const district = ppd.replace(/^PPD\s+/i, '').trim() || null

  return {
    schoolCode: (record['KOD SEKOLAH'] || '').trim(),
    schoolName: (record['NAMA SEKOLAH'] || '').trim(),
    schoolType: (record['JENISSEKOLAH'] || '').trim(),
    state,
    district,
  }
}

async function main() {
  console.log(`Reading ${CSV_PATH}...`)
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8')

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })
  console.log(`Parsed ${records.length} rows.`)

  const operating = records.filter((r) => (r['STATUS'] || '').trim() === 'Beroperasi')
  console.log(`${operating.length} rows with STATUS = Beroperasi (skipping ${records.length - operating.length} closed/blank).`)

  const rows = operating
    .map(toSchoolRow)
    .filter((r) => r.schoolCode && r.schoolName)

  let imported = 0
  let skippedNoState = 0

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)
    await Promise.all(chunk.map(async (row) => {
      if (!row.state) { skippedNoState++ }
      await prisma.school.upsert({
        where: { schoolCode: row.schoolCode },
        update: {
          schoolName: row.schoolName,
          schoolType: row.schoolType,
          state: row.state,
          district: row.district,
        },
        create: {
          schoolCode: row.schoolCode,
          schoolName: row.schoolName,
          schoolType: row.schoolType,
          state: row.state,
          district: row.district,
        },
      })
    }))
    imported += chunk.length
    console.log(`  upserted ${imported}/${rows.length}...`)
  }

  console.log(`Done. ${imported} schools upserted.`)
  if (skippedNoState > 0) {
    console.log(`Note: ${skippedNoState} rows had an unrecognized NEGERI value and were imported with state = null.`)
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
