# Aplikasi Maintenance — Laporan Mesin & Checklist PM

Aplikasi web (HTML/CSS/JS biasa, tanpa framework) untuk operator mencatat
kondisi mesin & mengisi checklist preventive maintenance (PM), dengan alur
**draft → review SPV** sebelum masuk rekap resmi. Supabase (Postgres)
dipakai sebagai database + storage foto.

## Alur kerja singkat

1. **Operator** login (akun sendiri) → isi **Laporan Mesin** dan/atau
   **Checklist PM** → tersimpan sebagai **draft**.
2. **SPV** login → dapat notifikasi (lonceng di topbar) tiap ada draft
   baru → buka halaman **Draft** → **Approve** atau **Reject** (dengan
   alasan).
3. Data yang sudah di-approve/reject tetap tercatat riwayatnya dan
   terlihat statusnya di halaman **Rekap Laporan** & **Rekap Checklist
   PM**, lengkap dengan badge status review dan export Excel.
4. **Superadmin** punya semua hak SPV, ditambah halaman **Kelola User**
   untuk bikin/ubah/nonaktifkan akun operator, SPV, maupun superadmin
   lain.

## Isi folder

```
login.html                     login pakai username & password
index.html                     dashboard ringkasan (SPV & superadmin)
laporan.html                   form Laporan Mesin (semua role)
rekap.html                     rekap laporan + export Excel (SPV & superadmin)
pm.html                        pilih equipment & periode checklist PM (semua role)
checklist.html                 form isian checklist PM (semua role)
rekap-pm.html                  rekap checklist PM + detail + export Excel (SPV & superadmin)
production.html                pilih equipment & periode form Production (semua role)
production-checklist.html      form isian checklist Production (semua role)
rekap-production.html          rekap Production + detail + export Excel (SPV & superadmin)
draft.html                     tinjau & approve/reject draft (SPV & superadmin) — laporan, Checklist PM, & Production
kelola-user.html               kelola akun: tambah/edit/reset password/nonaktifkan (khusus superadmin)

css/
  style.css                    tampilan semua halaman

js/
  config.js                    isi URL & anon key project Supabase kamu di sini
  auth.js                      sesi login, hash password, penjaga akses halaman,
                                sidebar/topbar sesuai peran, lonceng notifikasi
  login.js                     logic halaman login (cek akun ke database)
  kelola-user.js                logic halaman Kelola User (khusus superadmin)
  app.js                       logic form Laporan Mesin + koneksi Supabase
  checklist.js                 logic form Checklist PM
  checklist-data.js            daftar checklist per equipment/periode (data statis)
  pm.js                        logic halaman pilih checklist PM
  production-checklist.js      logic form Production (sama pola dengan checklist.js)
  production-data.js           daftar checklist Production per equipment/periode (data statis,
                                sumbernya file Excel "Maintenance Task List" per line — sudah ada
                                Extrusion & Gummy Candy, line lain menyusul)
  production.js                logic halaman pilih checklist Production
  rekap-production.js          rekap Production: filter, tabel, badge review, export Excel
  rekap.js                     rekap laporan: filter, tabel, badge review, export Excel
  rekap-pm.js                  rekap checklist PM: filter, detail, badge review, export Excel
  draft.js                     logic halaman Draft: tab status, approve/reject
  notify.js                    kirim notifikasi ke SPV tiap ada laporan/checklist baru
  dashboard.js                 logic dashboard ringkasan
  sidebar.js                   buka/tutup sidebar (semua halaman)

assets/
  logo.png                     logo di header

sql/                           jalankan urut sesuai nomor di bagian setup di bawah
  schema.sql
  seed_master_data.sql
  add_rekap_read_policy.sql
  add_multi_foto.sql
  add_pm_checklist.sql
  add_draft_workflow.sql
  add_user_accounts.sql
  add_pm_checklist_foto.sql

data/
  master_data.json             data mentah hasil olahan Excel (referensi/backup)
```

## Langkah setup

### 1. Buat project Supabase
Buka [supabase.com](https://supabase.com) → New Project. Tunggu sampai
project selesai dibuat.

### 2. Jalankan SQL, urut sesuai nomor
Buka **SQL Editor** di dashboard Supabase → New query → paste isi file →
Run. Jalankan **berurutan**, karena file belakangan butuh tabel/kolom
dari file sebelumnya:

1. `sql/schema.sql` — bikin tabel `area`/`mesin`/`equipment` (master data
   berjenjang), tabel `laporan`, RLS dasar (siapa saja boleh baca master
   data & insert laporan, tidak bisa ubah/hapus dari browser), dan
   storage bucket `foto-laporan` (public) untuk foto upload.
2. `sql/seed_master_data.sql` — isi 8 area, 73 mesin, ±586 equipment
   sesuai file Excel. Kalau data mesin di Excel berubah nanti, generate
   ulang file ini dari Excel versi baru.
3. `sql/add_rekap_read_policy.sql` — izin baca (read-only) ke tabel
   `laporan`, dibutuhkan supaya halaman rekap & draft bisa menampilkan
   data.
4. `sql/add_multi_foto.sql` — tabel `laporan_foto`, supaya 1 laporan
   Mesin bisa punya beberapa foto (dari kamera maupun galeri).
5. `sql/add_pm_checklist.sql` — tabel `pm_checklist_submission`, tempat
   hasil isian Checklist PM tersimpan.
6. `sql/add_draft_workflow.sql` — menambahkan alur draft & review:
   kolom `review_status` (`draft`/`approved`/`rejected`),
   `reviewed_by`, `reviewed_at`, `reject_reason` di tabel `laporan` &
   `pm_checklist_submission`; izin update dari browser (supaya SPV bisa
   approve/reject); dan tabel `notifikasi` untuk lonceng notifikasi SPV.
7. `sql/add_user_accounts.sql` — tabel `app_user` (akun per orang:
   username, password ter-hash, nama, role, aktif/tidak), plus 1 akun
   superadmin awal (`admin` / `admin123` — **ganti lewat halaman Kelola
   User begitu bisa login**).
8. `sql/add_pm_checklist_foto.sql` — tabel `pm_checklist_foto`, supaya 1
   Checklist PM bisa punya beberapa foto evidence (dari kamera maupun
   galeri, sama seperti `laporan_foto`); dan storage bucket
   `foto-checklist-pm` (public) untuk foto upload-nya.
9. `sql/add_production_checklist.sql` — modul baru **Production**
   (`production.html` / `production-checklist.html`): tabel
   `production_checklist_submission` + `production_checklist_foto`,
   storage bucket `foto-production-checklist`, dan izin tipe
   `production_checklist` di tabel `notifikasi`. Alurnya sama persis
   dengan Checklist PM (draft → review SPV → rekap). Datanya ada di
   `js/production-data.js`.

### 3. Ambil API key
**Project Settings → API**. Salin:
- **Project URL**
- **anon public key**

Paste ke `js/config.js`:

```js
export const SUPABASE_URL = "https://xxxxx.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

Password akun **tidak** lagi diatur di file ini — akun dibuat lewat
halaman **Kelola User** setelah login sebagai superadmin (lihat langkah
5 di bawah).

### 4. Jalankan/deploy

Karena file JS pakai ES module (`import`), file harus dibuka lewat web
server, bukan langsung double-click `login.html` (browser akan blokir
karena aturan CORS untuk `file://`).

**Coba lokal dulu** (dari folder project):
```bash
python3 -m http.server 8000
```
lalu buka `http://localhost:8000/login.html`.

**Deploy publik** (gratis, tinggal drag & drop folder ini):
- [Netlify Drop](https://app.netlify.com/drop)
- [Vercel](https://vercel.com) (import folder / hubungkan ke repo)
- Cloudflare Pages
- Atau GitHub Pages kalau foldernya di-push ke repo GitHub

Setelah deploy, link `login.html`-nya bisa langsung dibuka dari HP
operator di lantai produksi maupun laptop SPV — semua halaman responsif
untuk layar kecil.

### 5. Login pertama & buat akun asli

1. Buka `login.html`, masuk pakai akun default: username `admin`,
   password `admin123`.
2. Buka menu **Kelola User** di sidebar.
3. Reset password akun `admin` ke password baru yang cuma kamu tahu
   (tombol "Reset password").
4. Tambah akun asli untuk tiap operator/SPV yang perlu pakai app ini
   (username, nama, role, password awal — sebaiknya minta mereka ganti
   sendiri lewat superadmin kalau mau ganti password nanti, karena app
   ini belum ada fitur "ganti password sendiri" dari sisi user biasa).

## Peran & akses halaman

| Halaman | Operator | SPV | Superadmin |
|---|---|---|---|
| Login | ✅ | ✅ | ✅ |
| Input laporan (`laporan.html`) | ✅ | ✅ | ✅ |
| Checklist PM (`pm.html`, `checklist.html`) | ✅ | ✅ | ✅ |
| Dashboard (`index.html`) | – | ✅ | ✅ |
| Rekap laporan (`rekap.html`) | – | ✅ | ✅ |
| Rekap Checklist PM (`rekap-pm.html`) | – | ✅ | ✅ |
| Draft — review & approve/reject (`draft.html`) | – | ✅ | ✅ |
| Kelola User (`kelola-user.html`) | – | – | ✅ |
| Bersihkan Data (`kelola-user.html`) | – | – | ✅ |

Setelah login, sidebar otomatis cuma menampilkan menu yang jadi hak
peran itu (diatur `js/auth.js`, lewat atribut `data-allow` di tiap
`<body>` halaman dan `data-role` di tiap link sidebar). Kalau operator
mencoba buka URL rekap/draft/kelola-user langsung, otomatis dilempar
balik ke halaman defaultnya. Sesi login disimpan di `sessionStorage`,
jadi hilang otomatis kalau tab/browser ditutup — tinggal masuk lagi
lewat `login.html`.

## Cara kerja singkat

- **Login**: `login.js` mengirim username + password ke `loginWithUsername()`
  di `auth.js`, yang mencocokkan hash SHA-256 password dengan
  `password_hash` di tabel `app_user`. Kalau cocok dan akun aktif, data
  akun (id, username, nama, role) disimpan di sesi browser
  (`sessionStorage`).
- Saat halaman form dibuka, `app.js`/`checklist.js` mengambil data
  master (`area`/`mesin`/`equipment`, atau daftar checklist) sekali di
  awal, lalu dropdown difilter di sisi browser.
- Saat submit laporan atau checklist PM: data disimpan dengan
  `review_status = 'draft'` (default di database), lalu `notify.js`
  membuat 1 baris di tabel `notifikasi` supaya muncul di lonceng SPV.
  Untuk laporan Mesin, foto (kamera dan/atau galeri, bisa lebih dari
  satu) diupload ke storage bucket `foto-laporan`, URL publiknya
  disimpan di tabel `laporan_foto`.
- SPV/superadmin membuka `draft.html`, melihat semua draft (tab
  Menunggu review/Disetujui/Ditolak/Semua), lalu **Approve** (langsung)
  atau **Reject** (wajib isi alasan). Ini meng-update `review_status`,
  `reviewed_by` (nama akun yang login), `reviewed_at`, dan
  `reject_reason`. Membuka halaman Draft juga otomatis menandai semua
  notifikasi yang ada sebagai sudah dibaca.
- Halaman Rekap (laporan & checklist PM) menampilkan badge status review
  di tiap baris/kartu, dan ikut disertakan di export Excel.
- Dashboard (SPV & superadmin) menampilkan ringkasan hari ini plus kartu
  "Draft menunggu review" yang langsung mengarah ke halaman Draft.
- **Kelola User** (superadmin): tambah akun baru (password di-hash SHA-256
  sebelum dikirim ke database), edit data akun, reset password lewat
  modal terpisah, dan aktifkan/nonaktifkan akun. Akun tidak pernah
  dihapus permanen dari sini — cuma dinonaktifkan — supaya riwayat
  "direview/diinput oleh siapa" di data lama tetap utuh. Superadmin
  tidak bisa menonaktifkan akun yang sedang dipakainya sendiri, atau
  mengubah role akun sendiri jadi bukan superadmin, supaya tidak
  kekunci dari halaman ini.

## Catatan keamanan

App ini **belum** pakai Supabase Auth beneran (akun + sesi yang
diverifikasi di sisi server) — login cuma mencocokkan hash password ke
tabel `app_user` dari browser, dan pembatasan akses halaman ditegakkan
di sisi tampilan (role gate di `js/auth.js`), bukan di database. Artinya:

- Siapa pun yang punya Project URL + anon key kamu tetap bisa
  query/insert/update tabel `app_user` (dan tabel lain) langsung lewat
  API Supabase, di luar aplikasi ini.
- Password disimpan sebagai hash SHA-256, bukan plain text — jauh
  lebih baik dari versi sebelumnya (password bareng di kode), tapi
  SHA-256 polos juga bukan standar penyimpanan password yang paling
  kuat (idealnya pakai bcrypt/argon2 dengan salt, yang butuh proses di
  server, bukan di browser).
- Belum ada validasi "minimal 1 superadmin aktif" di level database.

Kalau nanti butuh proteksi yang lebih kuat (akun beneran lewat Supabase
Auth + RLS berbasis user, hashing password yang lebih kuat di server),
tinggal bilang — bisa dibantu migrasi.
