# 🏫 MySPAD School API Integration Guide

> **Dokumen lengkap:** Semua URL, setup, dan cara connect sistem luar ke data sekolah MySPAD.  
> **Versi:** 1.0 | **Tarikh:** Julai 2026  
> **Sistem:** MySPAD (myspad-jn.com)

---

## 📋 Senarai Semua URL Yang Terlibat

### Tier 1 — Sumber Data Asal (eNazir KPM)

| # | URL | Kegunaan | Auth |
|---|---|---|---|
| 1 | `https://enazir.moe.gov.my/APIcall.php/tssekolah` | Senarai penuh ~10,300 sekolah (JSON) | Tiada (public) |
| 2 | `https://enazir.moe.gov.my/APIcall.php/tkppd` | Lookup nama PPD | Tiada |
| 3 | `https://enazir.moe.gov.my/APIcall.php/tknegeri` | Lookup nama Negeri | Tiada |
| 4 | `https://enazir.moe.gov.my/oracle_api.php/sekolah` | Senarai sekolah dari Oracle DB | `api_key` param |
| 5 | `https://enazir.moe.gov.my/oracle_api.php/profil_sekolah` | Profil lengkap sekolah (8 sub-endpoint) | `api_key` param |
| 6 | `https://enazir.moe.gov.my/oracle_api.php/guru` | Senarai guru ikut sekolah/KP | `api_key` param |
| 7 | `https://enazir.moe.gov.my/mysql_api.php` | MySQL API Gateway (data Nazir) | `X-API-Key` header |

### Tier 2 — Backend MySPAD (Express, Port 3002)

| # | Method | URL | Kegunaan | Auth |
|---|---|---|---|---|
| 8 | `GET` | `https://myspad-jn.com/api/sekolah` | CRUD sekolah (internal) | JWT (Google OAuth) |
| 9 | `GET` | `https://myspad-jn.com/api/sekolah/kod/:kod` | Cari sekolah by kod | JWT |
| 10 | `GET` | `https://myspad-jn.com/api/oracle/profil-sekolah?kod_sekolah=XXX` | Profil lengkap + guru + statistik | JWT |
| 11 | `GET` | `https://myspad-jn.com/api/oracle/senarai-guru?kod_sekolah=XXX` | Senarai guru | JWT |
| 12 | `GET` | `https://myspad-jn.com/api/enazir/tkppd` | Lookup PPD (cached 7 hari) | JWT |
| 13 | `GET` | `https://myspad-jn.com/api/enazir/tknegeri` | Lookup Negeri (cached 7 hari) | JWT |

### Tier 3 — External Data API (Untuk Sistem Luar) ⭐

| # | Method | URL | Kegunaan | Auth |
|---|---|---|---|---|
| 14 | `GET` | `https://myspad-jn.com/api/data/` | Info API & senarai koleksi | `X-API-Key` header |
| 15 | `GET` | `https://myspad-jn.com/api/data/sekolahs` | Senarai sekolah (paginated) | `X-API-Key` header |
| 16 | `GET` | `https://myspad-jn.com/api/data/sekolahs/:id` | Satu sekolah by MongoDB `_id` | `X-API-Key` header |
| 17 | `POST` | `https://myspad-jn.com/api/data/sekolahs/query` | Advanced query dengan filter JSON | `X-API-Key` header |

---

## 🏗️ Seni Bina Aliran Data

```
┌──────────────────────────────────────────────────────────────┐
│                     SUMBER DATA (eNazir KPM)                  │
│  ┌─────────────────────────┐  ┌────────────────────────────┐ │
│  │ APIcall.php/tssekolah   │  │ oracle_api.php/sekolah     │ │
│  │ (Public REST, JSON)     │  │ (Oracle DB, api_key auth)  │ │
│  └───────────┬─────────────┘  └──────────────┬─────────────┘ │
└──────────────┼────────────────────────────────┼───────────────┘
               │                                │
               ▼                                ▼
┌──────────────────────────────────────────────────────────────┐
│                    SYNC SCRIPTS (Cron Jobs)                   │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ sync-sekolah-from-enazir.cjs                            │ │
│  │ • Fetch tssekolah → map fields → upsert MongoDB         │ │
│  │ • Jadual: Setiap Ahad 2:00 AM                           │ │
│  │ • Batch: 500 rekod, timeout 90s                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ sync-jenis-sekolah.cjs                                  │ │
│  │ • Fetch oracle_api.php/profil_sekolah (paginated)       │ │
│  │ • Update jenisSekolah, lokasi, jenisAsrama              │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                  MongoDB: collection `sekolahs`               │
│                  ~10,300+ dokumen sekolah                     │
│                                                              │
│  Field Utama:                                                │
│  • kodSekolah (unique index)    • ppd / kodPPD               │
│  • namaSekolah                  • negeri / kodNegeri         │
│  • daerah                       • jenisSekolah               │
│  • alamat, poskod, bandar       • peringkat, gred            │
│  • telefon, email, fax, laman   • lokasi, jenisBantuan       │
│  • pengetua, gpm                • sesi, jenisAsrama          │
│  • koordinat (lat/lng GPS)      • bilMurid, bilGuru          │
│  • isActive                     • enazirLastSync             │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                BACKEND API (Express.js :3002)                 │
│                                                              │
│  ┌─ /api/sekolah* ──► sekolahController (CRUD + RLS) ───┐   │
│  └─ /api/oracle/* ──► fetchOracle() proxy + cache ──────┘   │
│  ┌─ /api/enazir/* ──► proxy ke APIcall.php (7-day cache)    │
│  └─ /api/data/*   ──► External Data API (X-API-Key auth)    │
└──────────────────────────────┬───────────────────────────────┘
                               │
               ┌───────────────┼───────────────┐
               ▼                               ▼
┌──────────────────────┐          ┌──────────────────────────┐
│  FRONTEND MySPAD     │          │  SISTEM LUAR (3rd Party) │
│  (React + Vite)      │          │                          │
│  Auth: JWT (Google)  │          │  Auth: X-API-Key header  │
│  Base URL: /api      │          │  Base URL: /api/data     │
└──────────────────────┘          └──────────────────────────┘
```

---

## 🔑 Cara Setup API Key Untuk Sistem Luar

### Langkah 1: Jana API Key

```bash
cd /root/myspad/backend
node scripts/generate-api-key.js
```

Output:
```
API Key: mspd_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### Langkah 2: Daftarkan Dalam .env

Edit `/root/myspad/backend/.env`:

```env
EXTERNAL_API_KEYS=mspd_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6,mspd_key2,mspd_key3
```

> Boleh letak berbilang key, pisahkan dengan koma.

### Langkah 3: Restart Server

```bash
pm2 restart ecosystem.config.js
```

### Langkah 4: Test Connection

```bash
curl -H "X-API-Key: mspd_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" \
  "https://myspad-jn.com/api/data/sekolahs?limit=5"
```

---

## 📡 Connect Dari Sistem Luar — Code Examples

### 1. Dapatkan Semua Sekolah (Paginated)

```javascript
// Node.js / Axios
const axios = require('axios');

const API_BASE = 'https://myspad-jn.com/api/data';
const API_KEY  = 'mspd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

async function getAllSekolah() {
  const { data } = await axios.get(`${API_BASE}/sekolahs`, {
    headers: { 'X-API-Key': API_KEY },
    params: {
      page: 1,
      limit: 200,          // max 200 per page
      sort: 'kodSekolah',
      order: 'asc'
    }
  });

  console.log(`Total: ${data.pagination.total} sekolah`);
  console.log(`Page ${data.pagination.page}/${data.pagination.totalPages}`);
  return data.data;
}
```

```python
# Python / requests
import requests

API_BASE = 'https://myspad-jn.com/api/data'
API_KEY  = 'mspd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'

def get_all_sekolah():
    resp = requests.get(
        f'{API_BASE}/sekolahs',
        headers={'X-API-Key': API_KEY},
        params={'page': 1, 'limit': 200, 'sort': 'kodSekolah', 'order': 'asc'}
    )
    data = resp.json()
    print(f"Total: {data['pagination']['total']} sekolah")
    return data['data']
```

```bash
# curl
curl -H "X-API-Key: mspd_xxx" \
  "https://myspad-jn.com/api/data/sekolahs?page=1&limit=200&sort=kodSekolah&order=asc"
```

### 2. Cari Sekolah Mengikut Nama (Regex Search)

```javascript
// Cari semua sekolah yang ada "kebangsaan" dalam nama
const { data } = await axios.get(`${API_BASE}/sekolahs`, {
  headers: { 'X-API-Key': API_KEY },
  params: {
    filter_namaSekolah__regex: 'kebangsaan',
    limit: 50
  }
});
```

```bash
curl -H "X-API-Key: mspd_xxx" \
  "https://myspad-jn.com/api/data/sekolahs?filter_namaSekolah__regex=kebangsaan&limit=50"
```

### 3. Cari Sekolah Mengikut Negeri

```javascript
// Dapatkan semua sekolah di Johor
const { data } = await axios.get(`${API_BASE}/sekolahs`, {
  headers: { 'X-API-Key': API_KEY },
  params: {
    filter_negeri: 'JOHOR',
    limit: 200,
    fields: 'kodSekolah,namaSekolah,daerah,ppd,jenisSekolah'
  }
});
```

```bash
curl -H "X-API-Key: mspd_xxx" \
  "https://myspad-jn.com/api/data/sekolahs?filter_negeri=JOHOR&fields=kodSekolah,namaSekolah,daerah"
```

### 4. Cari Sekolah Mengikut Kod

```javascript
async function getSekolahByKod(kodSekolah) {
  const { data } = await axios.get(`${API_BASE}/sekolahs`, {
    headers: { 'X-API-Key': API_KEY },
    params: {
      filter_kodSekolah: kodSekolah,
      limit: 1
    }
  });

  if (data.data.length > 0) {
    return data.data[0];
  }
  return null;
}

// Guna:
const sekolah = await getSekolahByKod('BEA3042');
console.log(sekolah.namaSekolah); // "SMK Seri Ampang"
```

### 5. Advanced Query (POST /query)

```javascript
// Dapatkan sekolah menengah di Selangor yang aktif
const { data } = await axios.post(
  `${API_BASE}/sekolahs/query`,
  {
    filter: {
      negeri: 'SELANGOR',
      peringkat: 'MENENGAH',
      isActive: true
    },
    sort: { namaSekolah: 1 },
    limit: 100,
    page: 1
  },
  {
    headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' }
  }
);
```

### 6. Dapatkan Satu Sekolah by MongoDB ID

```bash
curl -H "X-API-Key: mspd_xxx" \
  "https://myspad-jn.com/api/data/sekolahs/64a1b2c3d4e5f6a7b8c9d0e1"
```

---

## 📊 Struktur Data Sekolah (Response Format)

Setiap dokumen sekolah dalam collection `sekolahs` mempunyai struktur berikut:

```json
{
  "_id": "64a1b2c3d4e5f6a7b8c9d0e1",
  "kodSekolah": "BEA3042",
  "namaSekolah": "SMK Seri Ampang",
  "negeri": "PERAK",
  "daerah": "KINTA UTARA",
  "ppd": "PPD Kinta Utara",
  "kodPPD": "A020",
  "kodNegeri": "08",
  "jenisSekolah": "SMK",
  "kodJenisSekolah": "201",
  "peringkat": "MENENGAH",
  "gred": "A",
  "lokasi": "BANDAR",
  "jenisBantuan": "SKB",
  "sesi": "PAGI",
  "jenisAsrama": "TIADA",
  "alamat": "Jalan Ampang",
  "poskod": "31350",
  "bandar": "Ipoh",
  "telefon": "05-1234567",
  "email": "bea3042@moe.edu.my",
  "fax": "05-1234568",
  "laman": "https://bea3042.moe.edu.my",
  "pengetua": "Nama PGB",
  "gpm": "Nama GPM",
  "koordinat": {
    "lat": 4.5678,
    "lng": 101.1234
  },
  "bilMurid": 1200,
  "bilGuru": 85,
  "parlimen": "P.064",
  "dun": "N.25",
  "akp": "PPW Kinta",
  "tarikhTubuh": "1995-01-01",
  "isActive": true,
  "enazirLastSync": "2026-07-13T02:00:00.000Z",
  "createdAt": "2025-06-15T08:00:00.000Z",
  "updatedAt": "2026-07-13T02:05:00.000Z"
}
```

---

## 🔢 Kod Jenis Sekolah (Rujukan)

| Kod | Jenis Sekolah | Peringkat |
|---|---|---|
| `101` | SK | RENDAH |
| `102` | SK | RENDAH |
| `103` | SJK(C) | RENDAH |
| `104` | SJK(T) | RENDAH |
| `105` | SK (Pendidikan Khas) | RENDAH |
| `201` | SMK | MENENGAH |
| `203` | SM Teknik | MENENGAH |
| `204` | SMK Agama | MENENGAH |
| `206` | SM Berasrama Penuh | MENENGAH |
| `207` | SBP | MENENGAH |
| `208` | Sekolah Sukan | MENENGAH |
| `210` | Sekolah Seni | MENENGAH |

> Untuk senarai lengkap 40+ kod, rujuk fail `JENIS_SEKOLAH_KOD_MAPPING` dalam:  
> `/root/myspad/scripts/sync-sekolah-from-enazir.cjs`

---

## ⚡ Rate Limit

| Had | Nilai |
|---|---|
| Request per minit | 120 / API key |
| Response bila exceed | `429 Too Many Requests` |
| Retry-After header | `60` saat |
| Maksimum `limit` per page | 200 rekod |

---

## 📂 Fail Rujukan Berkaitan

| Fail | Kandungan |
|---|---|
| `SCHOOL_API_INTEGRATION_GUIDE.md` | **← Anda di sini** — Panduan integrasi lengkap |
| `ENAZIR_ORACLE_API_REFERENCE.md` | Rujukan penuh Oracle API endpoints |
| `ENAZIR_INTEGRATION_PLAN.md` | Pelan integrasi eNazir MySQL API |
| `mysql_api_docs.md` | Dokumentasi MySQL API Gateway |
| `backend/EXTERNAL_DATA_API.md` | Dokumentasi External Data API (semua koleksi) |
| `scripts/sync-sekolah-from-enazir.cjs` | Script sync penuh sekolah |
| `backend/sync-jenis-sekolah.cjs` | Script sync Oracle profil sekolah |
| `backend/routes/dataApi.js` | Source code External Data API |
| `backend/routes/sekolah.js` | Source code CRUD routes sekolah |
| `backend/controllers/sekolahController.js` | Controller dengan RLS + pagination |
| `src/services/sekolahApi.js` | Frontend service (3-tier cache) |
| `src/services/sekolahService.js` | Frontend CRUD service |

---

## ❓ FAQ

### Q: Sistem luar saya perlukan semua 10,300 sekolah sekaligus. Boleh?

**A:** Boleh. Gunakan pagination dengan `limit=200` dan loop sehingga `pagination.hasNext === false`. Jangan guna `limit` melebihi 200 — server akan tolak.

### Q: Macam mana nak dapatkan data sekolah yang paling terkini?

**A:** Data disync dari eNazir setiap Ahad 2:00 AM. Check field `enazirLastSync` pada dokumen untuk tahu bila kali terakhir data dikemaskini.

### Q: Boleh dapatkan profil lengkap (guru, kelas, enrolmen) melalui External API?

**A:** External Data API hanya bagi akses ke MongoDB. Untuk data Oracle (profil lengkap, guru, kelas), perlu melalui backend proxy `/api/oracle/*` yang memerlukan JWT auth. Jika anda perlukan akses ini dari sistem luar, perlu tambah endpoint baru atau guna API key khas — bincang dengan team MySPAD.

### Q: Adakah API key tertakluk pada CORS?

**A:** Ya. CORS diurus oleh nginx. Domain sistem luar anda perlu di-whitelist dalam konfigurasi nginx. Default: hanya `myspad-jn.com` dan `localhost` dibenarkan.

---

> **Untuk bantuan lanjut:** Rujuk fail `EXTERNAL_DATA_API.md` untuk dokumentasi penuh semua koleksi (bukan sekolah sahaja), atau hubungi team MySPAD.
