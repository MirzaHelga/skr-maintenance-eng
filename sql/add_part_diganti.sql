-- ============================================================
-- PART YANG DIGANTI: tambah kolom free-text di tabel `laporan`
-- supaya operator bisa mencatat part apa saja yang diganti saat
-- perbaikan/maintenance mesin. Kolom ini opsional (boleh kosong).
-- ============================================================

alter table public.laporan
  add column if not exists part_diganti text;
