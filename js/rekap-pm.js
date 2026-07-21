import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import { SUPABASE_URL, SUPABASE_ANON_KEY, REKAP_PASSWORD } from "./config.js";
import { CHECKLIST_CATEGORIES } from "./checklist-data.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- ELEMENTS ----------
const gateWrap = document.getElementById("gate-wrap");
const gateForm = document.getElementById("gate-form");
const gateInput = document.getElementById("gate-input");
const gateError = document.getElementById("gate-error");
const gateSubmitBtn = gateForm.querySelector('button[type="submit"]');
const rekapWrap = document.getElementById("rekap-wrap");

const fTanggalDari = document.getElementById("f-tanggal-dari");
const fTanggalSampai = document.getElementById("f-tanggal-sampai");
const fChecklist = document.getElementById("f-checklist");
const fPeriode = document.getElementById("f-periode");
const btnFilter = document.getElementById("btn-filter");
const btnReset = document.getElementById("btn-reset");

const rekapCount = document.getElementById("rekap-count");
const rekapError = document.getElementById("rekap-error");
const rekapTbody = document.getElementById("rekap-tbody");
const btnExport = document.getElementById("btn-export");

const detailOverlay = document.getElementById("pm-detail-overlay");
const detailClose = document.getElementById("pm-detail-close");
const detailTitle = document.getElementById("pm-detail-title");
const detailSub = document.getElementById("pm-detail-sub");
const detailMeta = document.getElementById("pm-detail-meta");
const detailBody = document.getElementById("pm-detail-body");
const detailCatatan = document.getElementById("pm-detail-catatan");

const ATTEMPTS_KEY = "rekap-pm-attempts";
const MAX_ATTEMPTS = 5;

// baris yang sedang tampil (hasil filter terakhir) — ini yang dipakai export
let currentRows = [];

// dipakai supaya init cuma jalan sekali
let initialized = false;

// ---------- GERBANG PASSWORD (pakai password yang sama dengan Rekap Laporan) ----------
function unlock() {
  gateWrap.hidden = true;
  gateWrap.style.display = "none";
  rekapWrap.hidden = false;
  init();
}

function getAttempts() {
  return parseInt(sessionStorage.getItem(ATTEMPTS_KEY) || "0", 10);
}

function lockGate() {
  gateInput.disabled = true;
  gateSubmitBtn.disabled = true;
  gateError.hidden = false;
  gateError.textContent = `Sudah ${MAX_ATTEMPTS}x salah. Tutup dan buka lagi halaman ini (atau muat ulang) untuk coba lagi.`;
}

if (getAttempts() >= MAX_ATTEMPTS) {
  lockGate();
}

gateForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const typed = gateInput.value.trim();

  if (typed === REKAP_PASSWORD.trim()) {
    sessionStorage.removeItem(ATTEMPTS_KEY);
    gateError.hidden = true;
    unlock();
    return;
  }

  const attempts = getAttempts() + 1;
  sessionStorage.setItem(ATTEMPTS_KEY, String(attempts));

  if (attempts >= MAX_ATTEMPTS) {
    lockGate();
    return;
  }

  const sisaPercobaan = MAX_ATTEMPTS - attempts;
  gateError.hidden = false;
  gateError.textContent = `Password salah (kamu mengetik ${typed.length} karakter). Sisa percobaan: ${sisaPercobaan}x.`;
  gateInput.value = "";
  gateInput.focus();
});

// ---------- INIT (dipanggil sekali setelah unlock) ----------
async function init() {
  if (initialized) return;
  initialized = true;
  loadFilterOptions();
  await loadSubmissions();
}

// Filter "Checklist" & "Periode" diisi dari data statis checklist-data.js,
// jadi ga perlu query tambahan ke Supabase.
function loadFilterOptions() {
  const seenTitles = new Set();
  const seenPeriode = new Set();

  for (const category of CHECKLIST_CATEGORIES) {
    for (const checklist of category.checklists) {
      if (!seenTitles.has(checklist.id)) {
        seenTitles.add(checklist.id);
        const opt = document.createElement("option");
        opt.value = checklist.id;
        opt.textContent = `${checklist.title} (${checklist.periodeLabel})`;
        fChecklist.appendChild(opt);
      }
      seenPeriode.add(checklist.periodeLabel);
    }
  }

  for (const periode of [...seenPeriode].sort()) {
    const opt = document.createElement("option");
    opt.value = periode;
    opt.textContent = periode;
    fPeriode.appendChild(opt);
  }
}

// ---------- MUAT DATA CHECKLIST ----------
function showError(msg) {
  rekapError.textContent = msg;
  rekapError.hidden = false;
}

function clearError() {
  rekapError.hidden = true;
  rekapError.textContent = "";
}

async function loadSubmissions() {
  clearError();
  btnExport.disabled = true;
  rekapCount.textContent = "Memuat data…";
  rekapTbody.innerHTML = `<tr><td colspan="9" class="table-empty">Memuat data…</td></tr>`;

  let query = supabase
    .from("pm_checklist_submission")
    .select(
      "id, checklist_key, checklist_title, periode_label, equipment, area, bulan_tahun, items, tanggal_inspeksi, checked_by_opr, checked_by_spv, catatan"
    )
    .order("tanggal_inspeksi", { ascending: false })
    .order("created_at", { ascending: false });

  if (fTanggalDari.value) query = query.gte("tanggal_inspeksi", fTanggalDari.value);
  if (fTanggalSampai.value) query = query.lte("tanggal_inspeksi", fTanggalSampai.value);
  if (fChecklist.value) query = query.eq("checklist_key", fChecklist.value);
  if (fPeriode.value) query = query.eq("periode_label", fPeriode.value);

  const { data, error } = await query;

  if (error) {
    console.error(error);
    showError(
      "Gagal memuat data rekap. Pastikan sql/add_pm_checklist.sql sudah dijalankan di Supabase. (" +
        (error.message || "unknown error") +
        ")"
    );
    rekapCount.textContent = "";
    rekapTbody.innerHTML = `<tr><td colspan="9" class="table-empty">Gagal memuat data.</td></tr>`;
    return;
  }

  currentRows = data || [];
  renderTable(currentRows);
  rekapCount.textContent = `${currentRows.length} checklist ditemukan`;
  btnExport.disabled = currentRows.length === 0;
}

function renderTable(rows) {
  if (rows.length === 0) {
    rekapTbody.innerHTML = `<tr><td colspan="9" class="table-empty">Tidak ada checklist untuk filter ini.</td></tr>`;
    return;
  }

  rekapTbody.innerHTML = "";
  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatTanggal(row.tanggal_inspeksi)}</td>
      <td>${escapeHtml(row.checklist_title ?? "")}</td>
      <td>${escapeHtml(row.periode_label ?? "")}</td>
      <td>${escapeHtml(row.equipment ?? "")}</td>
      <td>${escapeHtml(row.area ?? "")}</td>
      <td>${escapeHtml(row.bulan_tahun ?? "")}</td>
      <td>${escapeHtml(row.checked_by_opr ?? "")}</td>
      <td>${escapeHtml(row.checked_by_spv ?? "")}</td>
      <td><button type="button" class="btn-link-btn pm-detail-btn">Lihat detail</button></td>
    `;
    tr.querySelector(".pm-detail-btn").addEventListener("click", () => openDetail(row));
    rekapTbody.appendChild(tr);
  }
}

// ---------- DETAIL MODAL ----------
function openDetail(row) {
  detailTitle.textContent = row.checklist_title ?? "";
  detailSub.textContent = `${row.periode_label ?? ""} · ${formatTanggal(row.tanggal_inspeksi)}`;

  detailMeta.innerHTML = `
    <div><span>Equipment</span><p>${escapeHtml(row.equipment || "—")}</p></div>
    <div><span>Area</span><p>${escapeHtml(row.area || "—")}</p></div>
    <div><span>Bulan/Tahun</span><p>${escapeHtml(row.bulan_tahun || "—")}</p></div>
    <div><span>Diperiksa OPR</span><p>${escapeHtml(row.checked_by_opr || "—")}</p></div>
    <div><span>Diperiksa SPV</span><p>${escapeHtml(row.checked_by_spv || "—")}</p></div>
  `;

  const items = row.items || [];
  const isGrid = items.length > 0 && items[0].values !== undefined;

  if (isGrid) {
    const columns = Object.keys(items[0].values || {});
    detailBody.innerHTML = `
      <div class="table-wrap">
        <table class="pm-detail-table">
          <thead>
            <tr>
              <th>Uraian</th>
              ${columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                (item) => `
              <tr>
                <td>
                  <p class="pm-detail-uraian">${item.no ?? ""}. ${escapeHtml(item.uraian ?? "")}</p>
                  ${item.standar ? `<p class="pm-detail-standar">Standar: ${escapeHtml(item.standar)}</p>` : ""}
                </td>
                ${columns.map((c) => `<td>${escapeHtml((item.values && item.values[c]) || "—")}</td>`).join("")}
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  } else {
    detailBody.innerHTML = `
      <div class="table-wrap">
        <table class="pm-detail-table">
          <thead>
            <tr>
              <th>Uraian</th>
              <th>Standar</th>
              <th>Hasil</th>
              <th>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                (item) => `
              <tr>
                <td>${item.no ?? ""}. ${escapeHtml(item.uraian ?? "")}</td>
                <td>${escapeHtml(item.standar || "—")}</td>
                <td>${escapeHtml(item.hasil || "—")}</td>
                <td>${escapeHtml(item.keterangan || "—")}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  detailCatatan.innerHTML = row.catatan
    ? `<p><span>Catatan:</span> ${escapeHtml(row.catatan)}</p>`
    : "";

  detailOverlay.hidden = false;
}

function closeDetail() {
  detailOverlay.hidden = true;
}

detailClose.addEventListener("click", closeDetail);
detailOverlay.addEventListener("click", (e) => {
  if (e.target === detailOverlay) closeDetail();
});

// ---------- HELPERS ----------
function formatTanggal(tanggal) {
  if (!tanggal) return "";
  const [y, m, d] = tanggal.split("-");
  return `${d}-${m}-${y}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ---------- FILTER ----------
btnFilter.addEventListener("click", () => loadSubmissions());

btnReset.addEventListener("click", () => {
  fTanggalDari.value = "";
  fTanggalSampai.value = "";
  fChecklist.value = "";
  fPeriode.value = "";
  loadSubmissions();
});

// ---------- EXPORT KE EXCEL ----------
btnExport.addEventListener("click", () => {
  if (currentRows.length === 0) return;

  const exportData = currentRows.map((row) => {
    const items = row.items || [];
    const isGrid = items.length > 0 && items[0].values !== undefined;
    const ringkasan = isGrid
      ? items
          .map((it) => `${it.uraian}: ${Object.values(it.values || {}).filter(Boolean).join("/") || "—"}`)
          .join(" | ")
      : items
          .map((it) => `${it.uraian}: ${it.hasil || "—"}${it.keterangan ? ` (${it.keterangan})` : ""}`)
          .join(" | ");

    return {
      Tanggal: formatTanggal(row.tanggal_inspeksi),
      Checklist: row.checklist_title ?? "",
      Periode: row.periode_label ?? "",
      Equipment: row.equipment ?? "",
      Area: row.area ?? "",
      "Bulan/Tahun": row.bulan_tahun ?? "",
      "Diperiksa OPR": row.checked_by_opr ?? "",
      "Diperiksa SPV": row.checked_by_spv ?? "",
      Catatan: row.catatan ?? "",
      "Isian Checklist": ringkasan,
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  worksheet["!cols"] = [
    { wch: 11 }, // Tanggal
    { wch: 32 }, // Checklist
    { wch: 10 }, // Periode
    { wch: 22 }, // Equipment
    { wch: 16 }, // Area
    { wch: 14 }, // Bulan/Tahun
    { wch: 16 }, // Diperiksa OPR
    { wch: 16 }, // Diperiksa SPV
    { wch: 30 }, // Catatan
    { wch: 60 }, // Isian Checklist
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Checklist PM");

  const today = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const filename = `rekap-checklist-pm_${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}.xlsx`;

  XLSX.writeFile(workbook, filename);
});
