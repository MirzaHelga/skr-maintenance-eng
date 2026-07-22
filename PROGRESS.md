# Progres: Fitur Superadmin & Akun per Orang

Melacak pengerjaan migrasi dari "password bersama per role" ke akun
per orang (username + password) dengan role tambahan **Superadmin**.
Dikerjakan bertahap per sesi supaya tidak kena limit.

## ✅ Sesi 1 — Pondasi database & login (SELESAI)

- [x] `sql/add_user_accounts.sql` — tabel `app_user` (username,
      password_hash, nama, role, is_active) + RLS + seed 1 akun
      superadmin default.
- [x] `js/auth.js` — tambah role `superadmin`, fungsi `hashPassword()`
      (SHA-256 via Web Crypto), fungsi `loginWithUsername()` yang query
      ke `app_user`, `setSession()` sekarang simpan data akun asli dari
      database (id, username, nama, role).
- [x] `login.html` + `js/login.js` — form login diganti dari "pilih
      role + password bersama" jadi **username + password**.
- [x] `js/config.js` — `ROLE_PASSWORDS` dihapus (sudah tidak dipakai).
- [x] Semua halaman yang tadinya `data-allow="spv"` /
      `data-allow="operator,spv"` ditambah `superadmin` (index,
      laporan, rekap, pm, checklist, rekap-pm, draft) — supaya
      superadmin otomatis kebagian akses yang sama seperti SPV plus
      nanti akses "Kelola User".
- [x] CSS: warna dot sidebar untuk role superadmin.

**Akun default setelah jalankan SQL:**
- Username: `admin`
- Password: `admin123`
- **Ganti password ini secepatnya** setelah fitur ganti password di
  Sesi 2 selesai (untuk sementara bisa diganti manual lewat SQL Editor
  — lihat komentar di `sql/add_user_accounts.sql`).

**Cara coba sesi ini:**
1. Jalankan `sql/add_user_accounts.sql` di Supabase SQL Editor (urutan
   terakhir, setelah `add_draft_workflow.sql`).
2. Buka `login.html`, masuk pakai `admin` / `admin123`.
3. Harus otomatis masuk ke dashboard (`index.html`) dengan akses penuh
   seperti SPV (belum ada menu "Kelola User" — itu Sesi 2).

## ✅ Sesi 2 — Halaman "Kelola User" (SELESAI)

- [x] Halaman baru `kelola-user.html` (khusus role `superadmin`, muncul
      di sidebar semua halaman tapi link-nya cuma kelihatan buat
      superadmin).
- [x] `js/kelola-user.js` — CRUD ke tabel `app_user`:
      - Tambah user baru (username, nama, role, password awal ≥6 karakter)
      - Edit data user (username, nama, role) — password TIDAK diubah
        lewat form edit, harus lewat tombol "Reset password" terpisah
        supaya tidak ke-reset tanpa sengaja.
      - Reset password (modal terpisah, minimal 6 karakter).
      - Aktifkan / nonaktifkan akun (bukan hapus permanen — riwayat
        `reviewed_by`/`pic` di data lama tetap jelas siapa).
- [x] Penjagaan supaya superadmin tidak mengunci diri sendiri:
      - Tidak bisa nonaktifkan akun yang sedang dipakai login saat itu.
      - Tidak bisa ubah role akun sendiri jadi bukan superadmin lewat
        form edit.
- [x] Link "Kelola User" ditambahkan ke sidebar semua halaman
      (`data-role="superadmin"` — otomatis hilang buat operator/spv).

**Cara coba sesi ini:**
1. Login sebagai `admin` / `admin123` (atau akun superadmin lain).
2. Klik menu "Kelola User" di sidebar.
3. Coba tambah akun baru (misal role `operator`, password bebas ≥6
   karakter), lalu logout dan coba login pakai akun baru itu.
4. Coba reset password akun tsb, dan coba nonaktifkan lalu login
   pakai akun itu — harus ditolak dengan pesan "akun dinonaktifkan".
5. Coba nonaktifkan akun `admin` yang lagi dipakai login — harus
   ditolak duluan oleh halaman (tidak sampai ke database).

**Belum sempurna / catatan untuk nanti:**
- Belum ada validasi "minimal harus ada 1 superadmin aktif" di level
  database — kalau superadmin terakhir nonaktifkan semua superadmin
  lain lalu logout, bisa kejebak butuh reset manual lewat SQL Editor.
  Untuk sekarang risiko ini kecil karena app cuma dipakai internal.
- Delete permanen akun sengaja tidak disediakan (dipilih nonaktifkan
  saja) supaya data lama (laporan/checklist yang di-review orang itu)
  tetap konsisten.

## ✅ Sesi 3 — Rapikan & dokumentasi (SELESAI)

- [x] Review ulang semua `data-allow`/`data-role` di tiap halaman —
      dicek otomatis, semua konsisten (operator/spv/superadmin sesuai
      tabel akses di README).
- [x] Pastikan tidak ada sisa kode lama (`ROLE_PASSWORDS`,
      `checkRolePassword`, dsb) — sudah bersih.
- [x] `README.md` ditulis ulang total: alur kerja, isi folder, langkah
      setup (termasuk `sql/add_user_accounts.sql` & login pertama pakai
      akun `admin`/`admin123`), tabel peran & akses (+ kolom
      Superadmin), cara kerja Kelola User, dan catatan keamanan yang
      sudah diperbarui (SHA-256, bukan lagi password bareng).
- [x] Checklist testing manual (di bawah) — **silakan jalankan sendiri**
      di project Supabase kamu sebelum dipakai beneran, karena saya
      tidak bisa mengakses database kamu langsung dari sini.

### Checklist testing manual

Jalankan urut, dari project Supabase yang sudah di-setup lengkap
(semua file di `sql/` sudah dijalankan sesuai README):

1. [ ] Login `admin` / `admin123` → masuk ke dashboard, sidebar
       menampilkan semua menu termasuk **Kelola User**.
2. [ ] Di Kelola User, reset password akun `admin` ke password baru →
       logout → login lagi pakai password baru → berhasil.
3. [ ] Tambah akun baru role **operator** → logout → login pakai akun
       itu → sidebar cuma menampilkan Input laporan & Checklist PM
       (tidak ada Dashboard/Rekap/Draft/Kelola User).
4. [ ] Coba buka langsung URL `rekap.html` saat login sebagai operator
       → harus otomatis dilempar balik ke `laporan.html`.
5. [ ] Tambah akun baru role **spv** → login → sidebar menampilkan
       semua menu kecuali Kelola User.
6. [ ] Sebagai superadmin, nonaktifkan akun operator dari langkah 3 →
       logout → coba login pakai akun itu → harus ditolak dengan pesan
       akun dinonaktifkan.
7. [ ] Sebagai superadmin yang sedang login, coba klik "Nonaktifkan"
       di baris akun sendiri → harus ditolak oleh halaman (alert),
       tidak sampai update ke database.
8. [ ] Username baru yang sama dengan yang sudah ada → harus muncul
       pesan "Username sudah dipakai".
9. [ ] Password kurang dari 6 karakter saat tambah/reset → harus
       ditolak dengan pesan validasi, tidak terkirim ke database.
10. [ ] Alur lama masih jalan: operator isi Laporan Mesin → SPV/
       superadmin dapat notifikasi lonceng → approve/reject di Draft →
       muncul di Rekap dengan badge status yang benar.

Kalau semua poin di atas lolos, fitur akun & superadmin sudah siap
dipakai. File `PROGRESS.md` ini boleh dihapus kapan saja setelah itu —
isinya cuma catatan riwayat pengerjaan, tidak dipakai oleh aplikasi.
