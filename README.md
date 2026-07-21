# Aplikasi Form Laporan Mesin

Form web (HTML/CSS/JS biasa, tanpa framework) untuk mencatat kondisi mesin,
dengan Supabase (Postgres) sebagai database + storage untuk foto.

Field form: **Area → Mesin → Equipment** (dropdown berjenjang, dari data
Excel kamu), **Tanggal, Jam, Shift (3 shift), Status (Running/Standby/
Maintenance/Breakdown), Deskripsi, PIC, Upload foto (bisa lebih dari 1;
di HP ada pilihan ambil foto langsung dari kamera juga)**.

## Isi folder

```
index.html                     halaman form
rekap.html                     halaman rekap laporan + export Excel (terkunci password)
css/
  style.css                    tampilan (form & rekap)
js/
  app.js                       logic form + koneksi Supabase
  rekap.js                     logic rekap: filter, tabel, export Excel
  config.js                    isi URL, anon key, & password rekap kamu di sini
assets/
  logo.png                     logo di header
sql/
  schema.sql                   bikin tabel, RLS, dan storage bucket
  add_rekap_read_policy.sql    tambahan: izin baca tabel laporan (untuk rekap.html)
  add_multi_foto.sql           tambahan: tabel laporan_foto (dukungan foto >1 per laporan)
  seed_master_data.sql         isi tabel area/mesin/equipment dari Excel kamu
data/
  master_data.json             data mentah hasil olahan Excel (referensi/backup)
```

## Langkah setup

### 1. Buat project Supabase
Buka [supabase.com](https://supabase.com) → New Project. Tunggu sampai
project selesai dibuat.

### 2. Jalankan schema
Buka **SQL Editor** di dashboard Supabase → New query → paste isi
`sql/schema.sql` → Run.

Ini akan membuat:
- Tabel `area`, `mesin`, `equipment` (master data, relasi berjenjang)
- Tabel `laporan` (isian form)
- Row Level Security: siapa saja boleh **baca** master data dan **insert**
  laporan, tapi tidak bisa mengubah/menghapus laporan yang sudah masuk
  dari sisi browser.
- Storage bucket `foto-laporan` (public) untuk foto upload.

### 3. Isi master data
Masih di SQL Editor → New query → paste isi `sql/seed_master_data.sql` →
Run.

Ini akan mengisi 8 area, 73 mesin, ±586 equipment sesuai file Excel kamu.
Kalau data mesin di Excel berubah nanti, generate ulang file ini (bisa
minta saya buatkan lagi dari Excel versi baru).

### 4. Izinkan baca data laporan (untuk halaman rekap)
Masih di SQL Editor → New query → paste isi `sql/add_rekap_read_policy.sql`
→ Run. Ini menambahkan izin baca (read-only) ke tabel `laporan`, dibutuhkan
supaya halaman rekap bisa menampilkan & export data.

### 5. Aktifkan dukungan foto lebih dari satu
Masih di SQL Editor → New query → paste isi `sql/add_multi_foto.sql` →
Run. Ini bikin tabel `laporan_foto` supaya 1 laporan bisa punya beberapa
foto (dari kamera maupun upload galeri).

### 6. Ambil API key
**Project Settings → API**. Salin:
- **Project URL**
- **anon public key**

Paste ke `js/config.js`, sekalian ganti password halaman rekap:

```js
export const SUPABASE_URL = "https://xxxxx.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOi...";
export const REKAP_PASSWORD = "password-kamu-sendiri";
```

### 7. Jalankan/deploy

Karena `app.js` pakai ES module (`import`), file harus dibuka lewat web
server, bukan langsung double-click index.html (browser akan blokir
karena aturan CORS untuk `file://`).

**Coba lokal dulu** (dari folder project):
```bash
python3 -m http.server 8000
```
lalu buka `http://localhost:8000`.

**Deploy publik** (gratis, tinggal drag & drop folder ini):
- [Netlify Drop](https://app.netlify.com/drop)
- [Vercel](https://vercel.com) (import folder / hubungkan ke repo)
- Cloudflare Pages
- Atau GitHub Pages kalau foldernya di-push ke repo GitHub

Setelah deploy, link-nya bisa langsung dibuka dari HP operator di lantai
produksi — form ini responsif untuk layar kecil.

## Cara kerja singkat

- Saat halaman dibuka, `app.js` mengambil semua data `area`, `mesin`,
  `equipment` dari Supabase sekali di awal, lalu dropdown Mesin dan
  Equipment difilter di sisi browser (jadi ganti-ganti pilihan Area
  terasa instan, tidak perlu query ulang tiap klik).
- Saat submit: laporan disimpan dulu, lalu kalau ada foto (dari kamera
  dan/atau galeri, bisa lebih dari satu), tiap foto diupload ke storage
  bucket `foto-laporan`, dan URL publiknya disimpan di tabel
  `laporan_foto`, terhubung ke laporan tersebut.
- Di HP, ada 2 tombol: "Ambil foto" (langsung buka kamera) dan "Upload
  foto" (buka galeri, bisa pilih beberapa foto sekaligus). Di PC/laptop
  cuma tombol "Upload foto" yang muncul (buka file explorer), karena
  kamera tidak relevan di situ. Kedua tombol bisa dipakai berulang kali
  sebelum submit — semua foto yang sudah dipilih tampil sebagai grid dan
  bisa dihapus satu-satu.
- Tidak ada login/autentikasi — form ini publik lewat anon key. Kalau
  nanti mau dibatasi (misal harus login dulu), tinggal bilang, saya
  bantu tambahkan Supabase Auth.

## Halaman rekap & export Excel

`rekap.html` menampilkan tabel laporan yang sudah masuk, dengan filter
tanggal/area/status, dan tombol **Export ke Excel** (file `.xlsx` dibuat
langsung di browser, tidak perlu server tambahan). Ada link ke halaman
ini dari form (`Lihat rekap laporan & export Excel →`).

Halaman ini dikunci password sederhana (diisi lewat `REKAP_PASSWORD` di
`config.js`) supaya tidak sembarangan dibuka. Perlu diingat: ini proteksi
di sisi tampilan saja, bukan pengaman data di level database — siapa pun
yang punya Project URL + anon key kamu tetap bisa query tabel `laporan`
langsung. Kalau nanti butuh proteksi yang lebih kuat (login per user),
tinggal minta, bisa dibantu tambahkan Supabase Auth.
