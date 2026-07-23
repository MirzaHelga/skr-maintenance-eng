-- ============================================================
-- DELETE POLICY: supaya laporan/checklist lama yang udah approved
-- bisa dibersihkan (dihapus permanen) dari aplikasi.
--
-- Catatan yang sama seperti policy update di add_draft_workflow.sql:
-- app ini masih pakai anon key + password bersama per role, jadi
-- pembatasan "siapa yang boleh hapus" ditegakkan di sisi tampilan
-- (role gate di JS), bukan di RLS.
-- ============================================================

create policy "laporan deletable by anyone" on public.laporan
  for delete using (true);

create policy "laporan_foto deletable by anyone" on public.laporan_foto
  for delete using (true);

create policy "pm checklist deletable by anyone" on public.pm_checklist_submission
  for delete using (true);

create policy "pm_checklist_foto deletable by anyone" on public.pm_checklist_foto
  for delete using (true);

create policy "production checklist deletable by anyone" on public.production_checklist_submission
  for delete using (true);

create policy "production_checklist_foto deletable by anyone" on public.production_checklist_foto
  for delete using (true);
