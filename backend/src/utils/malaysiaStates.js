// Senarai 16 negeri/wilayah persekutuan Malaysia — asas peranan Penyelaras JPN
// (satu PIC negeri mewakili semua sekolah dalam negeri berkenaan; ~10k sekolah
// diselaraskan melalui ~16 PIC negeri, bukan PIC per-sekolah).
// PENTING: nilai ini mesti sepadan dengan School.state dalam DB (case-sensitive)
// supaya carian Penyelaras JPN mengikut negeri sekolah berfungsi betul.
const MALAYSIA_STATES = [
  'Perlis', 'Kedah', 'Pulau Pinang', 'Perak', 'Selangor', 'Kuala Lumpur',
  'Putrajaya', 'Negeri Sembilan', 'Melaka', 'Johor', 'Pahang', 'Terengganu',
  'Kelantan', 'Sabah', 'Sarawak', 'Labuan',
]

module.exports = { MALAYSIA_STATES }
