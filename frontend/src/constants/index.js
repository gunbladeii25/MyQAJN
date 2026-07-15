// Bahasa disokong oleh dropdown penukar bahasa (Header). "base: true" ialah
// bahasa asal sistem (BM) — dipapar terus tanpa carian DB. Bahasa lain
// diterjemah melalui jadual Translation (backend) dikunci oleh kod ISO di
// sini. UNTUK TAMBAH BAHASA BAHARU: tambah satu entri di bawah sahaja
// (cth. { code: 'ZH', label: '中文' }) — tiada perubahan skema/kod backend
// diperlukan; admin kemudian guna alat "Jana Terjemahan" untuk isi jadual.
export const SUPPORTED_LANGUAGES = [
  { code: 'BM', label: 'Bahasa Melayu', base: true },
  { code: 'EN', label: 'English' },
]

export const ROLES = {
  admin: { label: 'Administrator', color: 'bg-purple-100 text-purple-700' },
  peneraju_sektor: { label: 'Peneraju Sektor', color: 'bg-primary-100 text-primary-700' },
  top_management: { label: 'Pengurusan Atasan', color: 'bg-success-100 text-success-700' },
  penyelaras_jpn: { label: 'Penyelaras JPN', color: 'bg-teal-100 text-teal-700' },
  penganalisis_data: { label: 'Penganalisis Data', color: 'bg-warning-100 text-warning-700' },
}

// Halaman utama (landing) selepas log masuk, mengikut peranan — dipadankan
// dengan nav Sidebar supaya tiada peranan mendarat di laman yang tidak
// kelihatan dalam sidebar mereka sendiri.
export const DEFAULT_ROUTE_BY_ROLE = {
  admin: '/dashboard',
  peneraju_sektor: '/dashboard',
  top_management: '/dashboard',
  penyelaras_jpn: '/cases',
  penganalisis_data: '/ingestion',
}

export const SECTORS = ['SDTM', 'SPIP', 'SPHEMK', 'SDP', 'SPK', 'SPKN']

// Penyelaras JPN — satu PIC negeri menerima eskalasi kes bagi SEMUA sekolah
// dalam negeri berkenaan (bukan PIC per-sekolah — tidak berskala untuk ~10k
// sekolah). Nilai ini MESTI sepadan dengan School.state dalam DB.
export const MALAYSIA_STATES = [
  'Perlis', 'Kedah', 'Pulau Pinang', 'Perak', 'Selangor', 'Kuala Lumpur',
  'Putrajaya', 'Negeri Sembilan', 'Melaka', 'Johor', 'Pahang', 'Terengganu',
  'Kelantan', 'Sabah', 'Sarawak', 'Labuan',
]

// 19 nilai sebenar JENISSEKOLAH daripada senarai_sekolah.csv (backend/data,
// diimport ke School.schoolType) — termasuk "SM  Agama (SABK)" dengan ruang
// berganda, itu nilai sebenar dalam data sumber, bukan salah taip di sini.
export const SCHOOL_TYPES = [
  'Kolej Tingkatan 6', 'Kolej Vokasional', 'SJK(C)', 'SJK(T)', 'SK',
  'SK (Pendidikan Khas)', 'SM  Agama (SABK)', 'SM (Pendidikan Khas)',
  'SM + SR (Model Khas)', 'SM Berasrama Penuh', 'SM Teknik', 'SMK',
  'SMK Agama', 'SR Agama (SABK)', 'SR Model Khas Komprehensif K9',
  'Sekolah Bimbingan Jalinan Kasih', 'Sekolah Model Khas Komprehensif 11',
  'Sekolah Seni', 'Sekolah Sukan',
]

export const SECTOR_NAMES = {
  SDTM: 'Sektor Dasar dan Tadbir Urus Maklumat',
  SPIP: 'Sektor Pemastian dan Intervensi Pentaksiran',
  SPHEMK: 'Sektor Pembangunan Holistik, Ekosistem, dan Modal Komuniti',
  SDP: 'Sektor Dasar Pengajaran',
  SPK: 'Sektor Penjaminan Kualiti',
  SPKN: 'Sektor Penyelarasan dan Kawalan Nazir',
}

// RED/BLUE/GREEN map onto MYDS danger/primary/success tokens directly.
// ORANGE/YELLOW have no MYDS equivalent (MYDS only defines 3 semantic
// colours) so they keep Tailwind's stock orange/amber scales, weighted
// to match the same bg-100/text-700/dot-500/border-300 pattern.
export const ALERT_COLORS = {
  RED:    { bg: 'bg-danger-100',  text: 'text-danger-700',  dot: 'bg-danger-500',  border: 'border-danger-300'  },
  ORANGE: { bg: 'bg-orange-100',  text: 'text-orange-700',  dot: 'bg-orange-500',  border: 'border-orange-300'  },
  YELLOW: { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500',   border: 'border-amber-300'   },
  BLUE:   { bg: 'bg-primary-100', text: 'text-primary-700', dot: 'bg-primary-500', border: 'border-primary-300' },
  GREEN:  { bg: 'bg-success-100', text: 'text-success-700', dot: 'bg-success-500', border: 'border-success-300' },
}

export const DI_LABELS = {
  EXTREME_DISCREPANCY: 'Discrepancy Ekstrem',
  SEVERE_DISCREPANCY:  'Discrepancy Teruk',
  MODERATE_DISCREPANCY:'Discrepancy Sederhana',
  MINOR_DISCREPANCY:   'Discrepancy Minor',
  DATA_ALIGNED:        'Data Selaras',
}

export const CASE_STATUS = {
  pending:   { label: 'Menunggu',    color: 'bg-amber-100 text-amber-700' },
  reviewed:  { label: 'Disemak',     color: 'bg-primary-100 text-primary-700' },
  escalated: { label: 'Tindakan Segera', color: 'bg-orange-100 text-orange-700' },
  closed:    { label: 'Ditutup',     color: 'bg-gray-100 text-gray-600'    },
}

export const SOURCE_SYSTEMS = [
  { code: 'EMIS',        label: 'EMIS — Education Management Information System (KPM)' },
  { code: 'APDM',        label: 'APDM — Aplikasi Pangkalan Data Murid (KPM)' },
  { code: 'SKAS',        label: 'SK@S — Sistem Sekolah Angkat Swasta' },
  { code: 'SKPK',        label: 'SKPK — Sistem Penilaian Kualiti Kurikulum (KPM)' },
  { code: 'JPN_REPORT',  label: 'Laporan JPN — Jabatan Pendidikan Negeri' },
  { code: 'PPD_REPORT',  label: 'Laporan PPD — Pejabat Pendidikan Daerah' },
  { code: 'SCHOOL_RPT',  label: 'Laporan Sekolah (PDF / Excel / DOCX)' },
  { code: 'MANUAL',      label: 'Input Manual oleh Pegawai JN' },
]
