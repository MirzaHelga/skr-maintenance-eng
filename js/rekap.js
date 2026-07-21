import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import { SUPABASE_URL, SUPABASE_ANON_KEY, REKAP_PASSWORD } from "./config.js";

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
const fArea = document.getElementById("f-area");
const fStatus = document.getElementById("f-status");
const btnFilter = document.getElementById("btn-filter");
const btnReset = document.getElementById("btn-reset");

const rekapCount = document.getElementById("rekap-count");
const rekapError = document.getElementById("rekap-error");
const rekapTbody = document.getElementById("rekap-tbody");
const btnExport = document.getElementById("btn-export");

const ATTEMPTS_KEY = "rekap-attempts";
const MAX_ATTEMPTS = 5;

// baris yang sedang tampil (hasil filter terakhir) — ini yang dipakai export
let currentRows = [];

// dipakai supaya loadAreaFilter()+loadLaporan() cuma jalan sekali
let initialized = false;

// ---------- GERBANG PASSWORD ----------
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

// Setiap buka/refresh halaman ini, gerbang password selalu tampil lagi —
// tidak diingat lintas kunjungan. Cuma limit percobaan yang tetap dicek.
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
  await loadAreaFilter();
  await loadLaporan();
}

async function loadAreaFilter() {
  const { data, error } = await supabase.from("area").select("id, nama").order("nama");
  if (error) {
    console.error(error);
    return;
  }
  for (const area of data) {
    const opt = document.createElement("option");
    opt.value = area.id;
    opt.textContent = area.nama;
    fArea.appendChild(opt);
  }
}

// ---------- MUAT DATA LAPORAN ----------
function showError(msg) {
  rekapError.textContent = msg;
  rekapError.hidden = false;
}

function clearError() {
  rekapError.hidden = true;
  rekapError.textContent = "";
}

const STATUS_CLASS = {
  Running: "running",
  Standby: "standby",
  Maintenance: "maintenance",
  Breakdown: "breakdown",
};

async function loadLaporan() {
  clearError();
  btnExport.disabled = true;
  rekapCount.textContent = "Memuat data…";
  rekapTbody.innerHTML = `<tr><td colspan="10" class="table-empty">Memuat data…</td></tr>`;

  let query = supabase
    .from("laporan")
    .select("tanggal, jam, shift, status, deskripsi, pic, area:area_id(nama), mesin:mesin_id(nama), equipment:equipment_id(nama), laporan_foto(foto_url)")
    .order("tanggal", { ascending: false })
    .order("jam", { ascending: false });

  if (fTanggalDari.value) query = query.gte("tanggal", fTanggalDari.value);
  if (fTanggalSampai.value) query = query.lte("tanggal", fTanggalSampai.value);
  if (fArea.value) query = query.eq("area_id", fArea.value);
  if (fStatus.value) query = query.eq("status", fStatus.value);

  const { data, error } = await query;

  if (error) {
    console.error(error);
    showError(
      "Gagal memuat data rekap. Pastikan policy baca tabel laporan sudah dijalankan (lihat add_rekap_read_policy.sql). (" +
        (error.message || "unknown error") +
        ")"
    );
    rekapCount.textContent = "";
    rekapTbody.innerHTML = `<tr><td colspan="10" class="table-empty">Gagal memuat data.</td></tr>`;
    return;
  }

  currentRows = data || [];
  renderTable(currentRows);
  rekapCount.textContent = `${currentRows.length} laporan ditemukan`;
  btnExport.disabled = currentRows.length === 0;
}

function renderTable(rows) {
  if (rows.length === 0) {
    rekapTbody.innerHTML = `<tr><td colspan="10" class="table-empty">Tidak ada laporan untuk filter ini.</td></tr>`;
    return;
  }

  rekapTbody.innerHTML = "";
  for (const row of rows) {
    const tr = document.createElement("tr");
    const statusClass = STATUS_CLASS[row.status] || "";
    tr.innerHTML = `
      <td>${formatTanggal(row.tanggal)}</td>
      <td>${row.jam ? row.jam.slice(0, 5) : ""}</td>
      <td>${row.shift ?? ""}</td>
      <td>${row.area?.nama ?? ""}</td>
      <td>${row.mesin?.nama ?? ""}</td>
      <td>${row.equipment?.nama ?? ""}</td>
      <td><span class="status-badge status-${statusClass}">${row.status ?? ""}</span></td>
      <td class="col-deskripsi">${escapeHtml(row.deskripsi ?? "")}</td>
      <td>${row.pic ?? ""}</td>
      <td>${renderFotoLinks(row.laporan_foto)}</td>
    `;
    rekapTbody.appendChild(tr);
  }
}

function renderFotoLinks(fotos) {
  if (!fotos || fotos.length === 0) return "—";
  return fotos
    .map((f, i) => `<a href="${f.foto_url}" target="_blank" rel="noopener">Foto ${i + 1}</a>`)
    .join(" · ");
}

function formatTanggal(tanggal) {
  if (!tanggal) return "";
  const [y, m, d] = tanggal.split("-");
  return `${d}-${m}-${y}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- FILTER ----------
btnFilter.addEventListener("click", () => loadLaporan());

btnReset.addEventListener("click", () => {
  fTanggalDari.value = "";
  fTanggalSampai.value = "";
  fArea.value = "";
  fStatus.value = "";
  loadLaporan();
});

// ---------- EXPORT KE EXCEL ----------
btnExport.addEventListener("click", () => {
  if (currentRows.length === 0) return;

  const exportData = currentRows.map((row) => ({
    Tanggal: formatTanggal(row.tanggal),
    Jam: row.jam ? row.jam.slice(0, 5) : "",
    Shift: row.shift ?? "",
    Area: row.area?.nama ?? "",
    Mesin: row.mesin?.nama ?? "",
    Equipment: row.equipment?.nama ?? "",
    Status: row.status ?? "",
    Deskripsi: row.deskripsi ?? "",
    PIC: row.pic ?? "",
    "Link Foto": (row.laporan_foto || []).map((f) => f.foto_url).join("; "),
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  worksheet["!cols"] = [
    { wch: 11 }, // Tanggal
    { wch: 7 },  // Jam
    { wch: 9 },  // Shift
    { wch: 16 }, // Area
    { wch: 18 }, // Mesin
    { wch: 20 }, // Equipment
    { wch: 12 }, // Status
    { wch: 45 }, // Deskripsi
    { wch: 16 }, // PIC
    { wch: 30 }, // Link Foto
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Mesin");

  const today = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const filename = `rekap-laporan-mesin_${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}.xlsx`;

  XLSX.writeFile(workbook, filename);
});
