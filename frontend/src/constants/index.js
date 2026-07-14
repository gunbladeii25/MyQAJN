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
  admin: { label: 'Administrator', color: 'bg-purple-100 text-purple-800' },
  peneraju_sektor: { label: 'Peneraju Sektor', color: 'bg-blue-100 text-blue-800' },
  top_management: { label: 'Pengurusan Atasan', color: 'bg-green-100 text-green-800' },
  penyelaras_jpn: { label: 'Penyelaras JPN', color: 'bg-teal-100 text-teal-800' },
  penganalisis_data: { label: 'Penganalisis Data', color: 'bg-amber-100 text-amber-800' },
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

export const SECTOR_NAMES = {
  SDTM: 'Sektor Dasar dan Tadbir Urus Maklumat',
  SPIP: 'Sektor Pemastian dan Intervensi Pentaksiran',
  SPHEMK: 'Sektor Pembangunan Holistik, Ekosistem, dan Modal Komuniti',
  SDP: 'Sektor Dasar Pengajaran',
  SPK: 'Sektor Penjaminan Kualiti',
  SPKN: 'Sektor Penyelarasan dan Kawalan Nazir',
}

export const ALERT_COLORS = {
  RED:    { bg: 'bg-red-100',    text: 'text-red-800',    dot: 'bg-red-500',    border: 'border-red-300'    },
  ORANGE: { bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-500', border: 'border-orange-300' },
  YELLOW: { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500', border: 'border-yellow-300' },
  BLUE:   { bg: 'bg-blue-100',   text: 'text-blue-800',   dot: 'bg-blue-500',   border: 'border-blue-300'   },
  GREEN:  { bg: 'bg-green-100',  text: 'text-green-800',  dot: 'bg-green-500',  border: 'border-green-300'  },
}

export const DI_LABELS = {
  EXTREME_DISCREPANCY: 'Discrepancy Ekstrem',
  SEVERE_DISCREPANCY:  'Discrepancy Teruk',
  MODERATE_DISCREPANCY:'Discrepancy Sederhana',
  MINOR_DISCREPANCY:   'Discrepancy Minor',
  DATA_ALIGNED:        'Data Selaras',
}

export const CASE_STATUS = {
  pending:   { label: 'Menunggu',    color: 'bg-yellow-100 text-yellow-800' },
  reviewed:  { label: 'Disemak',     color: 'bg-blue-100 text-blue-800'    },
  escalated: { label: 'Tindakan Segera', color: 'bg-orange-100 text-orange-800' },
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
