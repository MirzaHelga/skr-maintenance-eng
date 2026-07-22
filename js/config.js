// ============================================================
// ISI DUA VARIABEL INI DENGAN DATA PROJECT SUPABASE KAMU.
// Ambil dari: Supabase Dashboard > Project Settings > API
// ============================================================

export const SUPABASE_URL = "https://adlqxjysmxesoxriwshm.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkbHF4anlzbXhlc294cml3c2htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwNTM3ODMsImV4cCI6MjA5OTYyOTc4M30.80v3Ple4WctAi2_UFkzJ0aAJTEe8y7irVP-ldACI5nw";

// ============================================================
// AKUN LOGIN
// Mulai versi ini, login TIDAK lagi pakai password bareng per role.
// Setiap orang punya akun sendiri (username + password), disimpan di
// tabel `app_user` (lihat sql/add_user_accounts.sql). Akun superadmin
// default: username "admin", password "admin123" — GANTI SEGERA
// setelah bisa login.
// ============================================================
