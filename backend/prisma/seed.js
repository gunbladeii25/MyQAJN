const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const hash = (pw) => bcrypt.hashSync(pw, 12)

  // Users
  await prisma.user.upsert({
    where: { email: 'admin@moe.gov.my' },
    update: {},
    create: {
      name: 'Administrator Sistem',
      email: 'admin@moe.gov.my',
      passwordHash: hash('Admin@1234'),
      role: 'admin',
    },
  })

  const sectorUsers = [
    { name: 'Peneraju SDTM', email: 'sdtm@moe.gov.my', pw: 'Sdtm@1234', sector: 'SDTM' },
    { name: 'Peneraju SPIP', email: 'spip@moe.gov.my', pw: 'Spip@1234', sector: 'SPIP' },
    { name: 'Peneraju SPHEMK', email: 'sphemk@moe.gov.my', pw: 'Sphemk@1234', sector: 'SPHEMK' },
    { name: 'Peneraju SDP', email: 'sdp@moe.gov.my', pw: 'Sdp@1234', sector: 'SDP' },
    { name: 'Peneraju SPK', email: 'spk@moe.gov.my', pw: 'Spk@1234', sector: 'SPK' },
    { name: 'Peneraju SPKN', email: 'spkn@moe.gov.my', pw: 'Spkn@1234', sector: 'SPKN' },
  ]

  for (const u of sectorUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        name: u.name,
        email: u.email,
        passwordHash: hash(u.pw),
        role: 'peneraju_sektor',
        sector: u.sector,
      },
    })
  }

  await prisma.user.upsert({
    where: { email: 'pengurusan@moe.gov.my' },
    update: {},
    create: {
      name: 'Ketua Pengurusan',
      email: 'pengurusan@moe.gov.my',
      passwordHash: hash('Mgmt@1234'),
      role: 'top_management',
    },
  })

  // Penganalisis Data — peranan ingestion-sahaja (pull/kelulusan sumber data),
  // tiada akses kes/brief. Dipisahkan daripada Peneraju Sektor kerana staf
  // data/ICT JN biasanya berlainan daripada kepimpinan sektor.
  await prisma.user.upsert({
    where: { email: 'data.analyst@moe.gov.my' },
    update: {},
    create: {
      name: 'Penganalisis Data',
      email: 'data.analyst@moe.gov.my',
      passwordHash: hash('Data@1234'),
      role: 'penganalisis_data',
    },
  })

  // Penyelaras JPN — satu PIC per negeri, menerima eskalasi kes bagi semua
  // sekolah dalam negeri berkenaan (bukan PIC per-sekolah — tidak berskala
  // untuk ~10k sekolah). Slug e-mel guna nama negeri (huruf kecil, tiada ruang).
  const MALAYSIA_STATES = [
    'Perlis', 'Kedah', 'Pulau Pinang', 'Perak', 'Selangor', 'Kuala Lumpur',
    'Putrajaya', 'Negeri Sembilan', 'Melaka', 'Johor', 'Pahang', 'Terengganu',
    'Kelantan', 'Sabah', 'Sarawak', 'Labuan',
  ]
  const stateSlug = (s) => s.toLowerCase().replace(/\s+/g, '')

  for (const state of MALAYSIA_STATES) {
    const slug = stateSlug(state)
    await prisma.user.upsert({
      where: { email: `jpn.${slug}@moe.gov.my` },
      update: {},
      create: {
        name: `Penyelaras JPN ${state}`,
        email: `jpn.${slug}@moe.gov.my`,
        passwordHash: hash('Jpn@1234'),
        role: 'penyelaras_jpn',
        state,
      },
    })
  }

  // Schools
  const schools = [
    {
      schoolCode: 'SKB001',
      schoolName: 'Sekolah Kebangsaan Bukit Aman',
      schoolType: 'SK',
      state: 'Selangor',
      district: 'Petaling',
      jnAuditScore: 78.5,
      lastAuditDate: '2024-03-15',
      integrityRiskIndex: 0.12,
      canteenHygieneScore: 82.0,
    },
    {
      schoolCode: 'SKB002',
      schoolName: 'Sekolah Kebangsaan Bandar Baru',
      schoolType: 'SK',
      state: 'Selangor',
      district: 'Klang',
      jnAuditScore: 65.0,
      lastAuditDate: '2023-07-20',
      integrityRiskIndex: 0.35,
      canteenHygieneScore: 58.0,
    },
    {
      schoolCode: 'SMK001',
      schoolName: 'Sekolah Menengah Kebangsaan Taman Jaya',
      schoolType: 'SMK',
      state: 'Kuala Lumpur',
      district: 'Cheras',
      jnAuditScore: 82.0,
      lastAuditDate: '2024-09-01',
      integrityRiskIndex: 0.08,
      canteenHygieneScore: 90.0,
    },
    {
      schoolCode: 'SMK002',
      schoolName: 'Sekolah Menengah Kebangsaan Dato Harun',
      schoolType: 'SMK',
      state: 'Perak',
      district: 'Ipoh',
      jnAuditScore: 55.0,
      lastAuditDate: '2022-08-10',
      integrityRiskIndex: 0.68,
      canteenHygieneScore: 45.0,
    },
    {
      schoolCode: 'SBP001',
      schoolName: 'Sekolah Berasrama Penuh Integrasi Gombak',
      schoolType: 'SBP',
      state: 'Selangor',
      district: 'Gombak',
      jnAuditScore: 91.0,
      lastAuditDate: '2025-01-15',
      integrityRiskIndex: 0.05,
      canteenHygieneScore: 95.0,
    },
    {
      schoolCode: 'MRSM001',
      schoolName: 'MRSM Kuala Terengganu',
      schoolType: 'MRSM',
      state: 'Terengganu',
      district: 'Kuala Terengganu',
      jnAuditScore: 88.5,
      lastAuditDate: '2024-11-20',
      integrityRiskIndex: 0.10,
      canteenHygieneScore: 88.0,
    },
    {
      schoolCode: 'SKK001',
      schoolName: 'Sekolah Kebangsaan Kampung Baru',
      schoolType: 'SKK',
      state: 'Sabah',
      district: 'Kota Kinabalu',
      jnAuditScore: 61.0,
      lastAuditDate: '2021-05-30',
      integrityRiskIndex: 0.45,
      canteenHygieneScore: 52.0,
    },
  ]

  for (const s of schools) {
    await prisma.school.upsert({
      where: { schoolCode: s.schoolCode },
      update: {},
      create: s,
    })
  }

  // Default Data Sources
  // sourceCategory: 'jn_baseline' = sumber data audit JN (kemaskini School.jnAuditScore)
  // sourceCategory: 'outsource'   = sumber data luar (cipta IngestionRecord untuk perbandingan DI)
  const dataSources = [
    // ── JN BASELINE SOURCES ───────────────────────────────────────────────────
    {
      name:           'SK@S — Sistem Kualiti Pendidikan Malaysia',
      sourceCode:     'SKAS',
      sourceType:     'api',
      sourceCategory: 'jn_baseline',
      apiUrl:         'https://skas.moe.gov.my/api/v1',
      apiAuthType:    'bearer',
      pullSchedule:   'manual',
      description:    'Sistem Kualiti Pendidikan Malaysia (JN). Menyediakan skor audit SKPMG2 per domain — Kurikulum, Kepimpinan, Kemajuan Murid, Pengurusan, Keselamatan. Kemaskini jnAuditScore sekolah.',
      fieldMappings: JSON.stringify({}),
    },
    {
      name:           'SKPK — Sistem Kualiti Pra Sekolah',
      sourceCode:     'SKPK',
      sourceType:     'api',
      sourceCategory: 'jn_baseline',
      apiUrl:         'https://skpk.moe.gov.my/api/v1',
      apiAuthType:    'bearer',
      pullSchedule:   'manual',
      description:    'Sistem Kualiti Pra Sekolah (JN). Menyediakan skor audit kualiti untuk institusi pra-sekolah (Taska/Tadika KPM). Kemaskini jnAuditScore sekolah pra-sekolah.',
      fieldMappings: JSON.stringify({}),
    },
    {
      name:           'Pemeriksaan JN — Google Drive',
      sourceCode:     'PEMERIKSAAN_JN',
      sourceType:     'document',
      sourceCategory: 'jn_baseline',
      apiUrl:         null,
      pullSchedule:   'manual',
      description:    'Dokumen pemeriksaan kualitatif/kuantitatif JN yang disimpan di Google Drive. Agent 0 akan ekstrak dan tukar ke skor numerik. Kemaskini jnAuditScore sekolah.',
      fieldMappings: JSON.stringify({
        domain_kurikulum:       { weight: 0.35 },
        domain_kepimpinan:      { weight: 0.20 },
        domain_kemajuan_murid:  { weight: 0.25 },
        domain_pengurusan:      { weight: 0.10 },
        domain_keselamatan:     { weight: 0.10 },
      }),
    },
    // ── OUTSOURCE COMPARISON SOURCES ─────────────────────────────────────────
    {
      name:           'EMIS — Education Management Information System',
      sourceCode:     'EMIS',
      sourceType:     'api',
      sourceCategory: 'outsource',
      apiUrl:         'https://emis.moe.gov.my/api/v1',
      apiAuthType:    'bearer',
      pullSchedule:   'monthly',
      description:    'Sistem pengurusan data pendidikan utama KPM. Menyediakan skor akademik, kehadiran, dan kelayakan guru. Dibandingkan dengan jnAuditScore untuk pengiraan DI.',
      // jn_dimension mesti guna kunci domain SKPM (skpm_structure.py / JnDomainScore.domain)
      fieldMappings: JSON.stringify({
        academic_performance:  { jn_dimension: 'kemenjadian_murid',      weight: 0.30 },
        attendance_rate:       { jn_dimension: 'pengurusan_hem',         weight: 0.20 },
        facilities_score:      { jn_dimension: 'kekuatan',               weight: 0.15 },
        teacher_qualification: { jn_dimension: 'kekuatan',               weight: 0.15 },
        co_curriculum:         { jn_dimension: 'pengurusan_kokurikulum', weight: 0.10 },
      }),
    },
    {
      name:           'APDM — Aplikasi Pangkalan Data Murid',
      sourceCode:     'APDM',
      sourceType:     'api',
      sourceCategory: 'outsource',
      apiUrl:         'https://apdm.moe.gov.my/api/v2',
      apiAuthType:    'apikey',
      pullSchedule:   'monthly',
      description:    'Pangkalan data murid KPM. Menyediakan maklumat kehadiran murid, kadar keciciran, dan peperiksaan. Dibandingkan dengan jnAuditScore.',
      fieldMappings: JSON.stringify({
        exam_pass_rate:   { jn_dimension: 'kemenjadian_murid', weight: 0.25 },
        attendance_rate:  { jn_dimension: 'pengurusan_hem',    weight: 0.20 },
        dropout_rate_inv: { jn_dimension: 'pengurusan_hem',    weight: 0.10 },
      }),
    },
    {
      name:           'Laporan JPN — Jabatan Pendidikan Negeri',
      sourceCode:     'JPN_REPORT',
      sourceType:     'document',
      sourceCategory: 'outsource',
      pullSchedule:   'manual',
      description:    'Laporan audit dan penilaian daripada Jabatan Pendidikan Negeri (PDF/DOCX/Excel). Diproses oleh Agent 0.',
      fieldMappings: JSON.stringify({
        academic_performance_doc: { jn_dimension: 'kemenjadian_murid', weight: 0.25 },
        facilities_doc:           { jn_dimension: 'kekuatan',          weight: 0.15 },
        discipline_doc:           { jn_dimension: 'pengurusan_hem',    weight: 0.10 },
      }),
    },
    {
      name:           'Laporan PPD — Pejabat Pendidikan Daerah',
      sourceCode:     'PPD_REPORT',
      sourceType:     'document',
      sourceCategory: 'outsource',
      pullSchedule:   'manual',
      description:    'Laporan pemantauan dan penilaian daripada Pejabat Pendidikan Daerah.',
      fieldMappings: JSON.stringify({}),
    },
  ]

  for (const ds of dataSources) {
    await prisma.dataSource.upsert({
      where: { sourceCode: ds.sourceCode },
      update: {},
      create: ds,
    })
  }

  console.log('Seed completed successfully.')
  console.log('\nDefault credentials:')
  console.log('  Admin         : admin@moe.gov.my / Admin@1234')
  console.log('  Peneraju SDTM : sdtm@moe.gov.my / Sdtm@1234')
  console.log('  Peneraju SPK  : spk@moe.gov.my / Spk@1234')
  console.log('  Top Management: pengurusan@moe.gov.my / Mgmt@1234')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

