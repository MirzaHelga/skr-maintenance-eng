import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import QRCode from "https://esm.sh/qrcode@1.5.3";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- ELEMENTS ----------
const fArea = document.getElementById("f-area");
const fCari = document.getElementById("f-cari");
const btnPrint = document.getElementById("btn-print");
const qrError = document.getElementById("qr-error");
const qrCount = document.getElementById("qr-count");
const qrGrid = document.getElementById("qr-grid");

let areas = [];
let mesinList = [];
let equipmentList = [];

function showError(msg) {
  qrError.textContent = msg;
  qrError.hidden = false;
}

// URL absolut ke form Laporan Mesin dengan equipment sudah dipilihkan,
// dibangun dari origin+path halaman ini saat ini supaya otomatis benar
// di domain/hosting mana pun app ini dipasang.
function buildLaporanUrl(equipmentId) {
  const path = window.location.pathname.replace(/qrcode\.html$/, "laporan.html");
  return `${window.location.origin}${path}?equipment=${equipmentId}`;
}

async function loadMasterData() {
  const [areaRes, mesinRes, equipmentRes] = await Promise.all([
    supabase.from("area").select("id, nama").order("nama"),
    supabase.from("mesin").select("id, area_id, nama").order("nama"),
    supabase.from("equipment").select("id, mesin_id, nama").order("nama"),
  ]);

  if (areaRes.error || mesinRes.error || equipmentRes.error) {
    console.error(areaRes.error || mesinRes.error || equipmentRes.error);
    showError("Gagal memuat data mesin/equipment. Cek koneksi atau konfigurasi Supabase.");
    qrCount.textContent = "";
    return;
  }

  areas = areaRes.data || [];
  mesinList = mesinRes.data || [];
  equipmentList = equipmentRes.data || [];

  fillAreaFilter();
  render();
}

function fillAreaFilter() {
  for (const area of areas) {
    const opt = document.createElement("option");
    opt.value = area.id;
    opt.textContent = area.nama;
    fArea.appendChild(opt);
  }
}

function matchesFilter(equipment, mesin, area, areaFilter, searchTerm) {
  if (areaFilter && area?.id !== areaFilter) return false;
  if (!searchTerm) return true;
  const haystack = `${equipment.nama} ${mesin?.nama || ""} ${area?.nama || ""}`.toLowerCase();
  return haystack.includes(searchTerm);
}

async function render() {
  const areaFilter = fArea.value || "";
  const searchTerm = (fCari.value || "").trim().toLowerCase();

  const mesinById = Object.fromEntries(mesinList.map((m) => [m.id, m]));
  const areaById = Object.fromEntries(areas.map((a) => [a.id, a]));

  const filtered = equipmentList
    .map((eq) => {
      const mesin = mesinById[eq.mesin_id];
      const area = mesin ? areaById[mesin.area_id] : null;
      return { equipment: eq, mesin, area };
    })
    .filter(({ equipment, mesin, area }) => matchesFilter(equipment, mesin, area, areaFilter, searchTerm))
    .sort((a, b) => {
      const areaCmp = (a.area?.nama || "").localeCompare(b.area?.nama || "");
      if (areaCmp !== 0) return areaCmp;
      const mesinCmp = (a.mesin?.nama || "").localeCompare(b.mesin?.nama || "");
      if (mesinCmp !== 0) return mesinCmp;
      return a.equipment.nama.localeCompare(b.equipment.nama);
    });

  qrCount.textContent = `${filtered.length} equipment ditemukan`;

  if (filtered.length === 0) {
    qrGrid.innerHTML = `<p class="table-empty">Tidak ada equipment yang cocok dengan filter ini.</p>`;
    return;
  }

  qrGrid.innerHTML = filtered
    .map(
      ({ equipment }) => `
      <div class="qr-card">
        <canvas class="qr-canvas" data-equipment-id="${equipment.id}"></canvas>
        <p class="qr-card-equipment"></p>
        <p class="qr-card-meta"></p>
      </div>
    `
    )
    .join("");

  // Isi teks pakai textContent (bukan template string) supaya aman dari
  // karakter aneh di nama mesin/equipment, lalu render QR per canvas.
  const cards = qrGrid.querySelectorAll(".qr-card");
  filtered.forEach(({ equipment, mesin, area }, i) => {
    const card = cards[i];
    card.querySelector(".qr-card-equipment").textContent = equipment.nama;
    card.querySelector(".qr-card-meta").textContent = `${mesin?.nama || "-"} · ${area?.nama || "-"}`;

    const canvas = card.querySelector(".qr-canvas");
    const url = buildLaporanUrl(equipment.id);
    QRCode.toCanvas(canvas, url, { width: 160, margin: 1 }, (err) => {
      if (err) console.error("Gagal render QR untuk", equipment.nama, err);
    });
  });
}

fArea.addEventListener("change", render);
fCari.addEventListener("input", debounce(render, 200));
btnPrint.addEventListener("click", () => window.print());

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

loadMasterData();
