import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SESSION_KEY = "mtc-role-session";

export const ROLE_LABEL = {
  operator: "Operator",
  spv: "SPV",
  superadmin: "Superadmin",
};

// Halaman default per role setelah login / kalau nyasar ke halaman
// yang bukan haknya.
export const DEFAULT_PAGE = {
  operator: "laporan.html",
  spv: "dashboard.html",
  superadmin: "dashboard.html",
};

// ---------- HASH PASSWORD (SHA-256, lewat Web Crypto API bawaan browser) ----------
// Bukan sekuat bcrypt/argon2, tapi jauh lebih baik daripada plain text,
// dan tidak butuh library tambahan. Dipakai baik saat login (cocokkan
// hash) maupun saat superadmin bikin/ubah password akun (modul
// berikutnya).
export async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------- LOGIN (akun per orang, dari tabel app_user) ----------
// Return: { ok: true, user } kalau berhasil, atau { ok: false, reason }
// reason: "not_found" | "wrong_password" | "inactive" | "error"
export async function loginWithUsername(username, password) {
  const uname = (username || "").trim().toLowerCase();
  if (!uname) return { ok: false, reason: "not_found" };

  const { data, error } = await supabase
    .from("app_user")
    .select("id, username, nama, role, password_hash, is_active")
    .eq("username", uname)
    .maybeSingle();

  if (error) {
    console.error(error);
    return { ok: false, reason: "error" };
  }
  if (!data) return { ok: false, reason: "not_found" };
  if (!data.is_active) return { ok: false, reason: "inactive" };

  const hash = await hashPassword(password);
  if (hash !== data.password_hash) return { ok: false, reason: "wrong_password" };

  return { ok: true, user: data };
}

// ---------- SESSION ----------
export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getRole() {
  return getSession()?.role || null;
}

// user = baris dari tabel app_user (id, username, nama, role, ...)
export function setSession(user) {
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      userId: user.id,
      username: user.username,
      role: user.role,
      nama: (user.nama || "").trim(),
      loginAt: Date.now(),
    })
  );
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  window.location.href = "index.html";
}

// Nama yang tampil di kolom "diinput/direview oleh" — pakai nama akun
// yang tersimpan di database, fallback ke username atau label role.
export function displayName() {
  const session = getSession();
  if (!session) return "";
  const label = ROLE_LABEL[session.role] || session.role;
  const who = session.nama || session.username;
  return who ? `${who} (${label})` : label;
}

function currentPageFile() {
  const path = window.location.pathname;
  return path.substring(path.lastIndexOf("/") + 1) || "index.html";
}

// ---------- PAGE GUARD ----------
// Dipanggil otomatis di bawah file ini. Halaman yang mau dijaga tinggal
// kasih atribut data-allow="operator,spv" di <body>. Halaman tanpa
// atribut itu (mis. login.html) dibiarkan lewat.
function guard() {
  const body = document.body;
  const allowAttr = body?.dataset?.allow;
  if (!allowAttr) return;

  const allowed = allowAttr.split(",").map((s) => s.trim()).filter(Boolean);
  const session = getSession();

  if (!session) {
    window.location.href = "index.html?next=" + encodeURIComponent(currentPageFile());
    return;
  }
  if (!allowed.includes(session.role)) {
    window.location.href = DEFAULT_PAGE[session.role] || "index.html";
    return;
  }

  initShell(session.role);
}

// ---------- SIDEBAR + TOPBAR SESUAI ROLE ----------
function initShell(role) {
  // Sembunyikan link sidebar yang bukan hak role ini. Link yang boleh
  // dilihat semua role dikasih data-role="all" di HTML.
  document.querySelectorAll(".sidebar-link[data-role]").forEach((link) => {
    const roles = link.dataset.role.split(",").map((s) => s.trim());
    if (!roles.includes("all") && !roles.includes(role)) {
      link.remove();
    }
  });

  addSidebarFooter(role);

  if (role === "spv") {
    setupNotificationBell();
  }
}

function addSidebarFooter(role) {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  const footer = document.createElement("div");
  footer.className = "sidebar-footer";
  const session = getSession();
  const namaText = session?.nama ? escapeHtml(session.nama) : ROLE_LABEL[role];
  footer.innerHTML = `
    <div class="sidebar-role">
      <span class="sidebar-role-dot sidebar-role-dot--${role}"></span>
      <div>
        <p class="sidebar-role-name">${namaText}</p>
        <p class="sidebar-role-label">${ROLE_LABEL[role]}</p>
      </div>
    </div>
    <button type="button" class="sidebar-logout" id="btn-logout">Keluar</button>
  `;
  sidebar.appendChild(footer);
  footer.querySelector("#btn-logout").addEventListener("click", logout);
}

// ---------- LONCENG NOTIFIKASI (khusus SPV) ----------
async function setupNotificationBell() {
  const topbarInner = document.querySelector(".topbar-inner");
  const menuBtn = document.getElementById("btn-menu");
  if (!topbarInner) return;

  const bellWrap = document.createElement("div");
  bellWrap.className = "notif-bell-wrap";
  bellWrap.innerHTML = `
    <button type="button" class="notif-bell" id="notif-bell" aria-label="Notifikasi">
      🔔
      <span class="notif-badge" id="notif-badge" hidden>0</span>
    </button>
    <div class="notif-dropdown" id="notif-dropdown" hidden>
      <p class="notif-dropdown-title">Notifikasi draft</p>
      <div class="notif-list" id="notif-list">
        <p class="notif-empty">Memuat…</p>
      </div>
      <a href="draft.html" class="notif-see-all">Lihat semua draft &rarr;</a>
    </div>
  `;

  if (menuBtn) {
    topbarInner.insertBefore(bellWrap, menuBtn);
  } else {
    topbarInner.appendChild(bellWrap);
  }

  const bellBtn = bellWrap.querySelector("#notif-bell");
  const dropdown = bellWrap.querySelector("#notif-dropdown");
  const badge = bellWrap.querySelector("#notif-badge");
  const list = bellWrap.querySelector("#notif-list");

  async function refresh() {
    const { data, error } = await supabase
      .from("notifikasi")
      .select("id, tipe, judul, pesan, created_at")
      .eq("dibaca", false)
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) {
      console.error(error);
      return;
    }

    const rows = data || [];
    if (rows.length === 0) {
      badge.hidden = true;
      list.innerHTML = `<p class="notif-empty">Tidak ada draft baru.</p>`;
      return;
    }

    badge.hidden = false;
    badge.textContent = rows.length > 9 ? "9+" : String(rows.length);
    list.innerHTML = rows
      .map(
        (n) => `
        <a href="draft.html" class="notif-item">
          <p class="notif-item-title">${escapeHtml(n.judul)}</p>
          <p class="notif-item-sub">${escapeHtml(n.pesan || "")}</p>
        </a>
      `
      )
      .join("");
  }

  bellBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.hidden = !dropdown.hidden;
  });
  document.addEventListener("click", (e) => {
    if (!bellWrap.contains(e.target)) dropdown.hidden = true;
  });

  refresh();
  // Polling ringan, bukan realtime — cukup buat kebutuhan "ada draft baru".
  setInterval(refresh, 30000);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

guard();
